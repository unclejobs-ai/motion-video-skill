#!/usr/bin/env python3
"""단계 게이트: 산출물을 측정해 PASS/BLOCK을 종료 코드로 판정한다.

사용법:  python3 harness/gate.py <단계> [프로젝트폴더=.]
단계:    story | character | keyframes | clips | audio | edit | final | all
종료 코드: 0 = 모든 검사 통과(WARN 허용), 1 = BLOCK 하나 이상, 2 = 사용법 오류
보고서:  <프로젝트>/qa/gate-<단계>.txt 에 같은 내용을 저장한다.

프로젝트 폴더 규칙
  STORY.md  character.txt  voices.json  edit.json
  sheet/*.png  key/<이름>.png  clip/<이름>.mp4  out/final.mp4  qa/clips-review.md  qa/review.md
클립 이름 = 키프레임 이름 = edit.json 의 src 클립 ID (clip:<이름>@<시작초>)

임계값은 환경 변수로 바꾼다: GATE_SSIM_START(0.55) GATE_LUFS(-14) GATE_LUFS_TOL(1.5) GATE_TP_MAX(-1.0)
주의: 클립 뒤쪽의 인물 변형은 SSIM으로 구분되지 않는다(정상 클립도 움직이면 값이 떨어진다). 그래서 프레임 스트립을 만들고 눈 검수 기록을 요구한다.
의존: python3 표준 라이브러리, ffmpeg, ffprobe
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SSIM_START = float(os.environ.get("GATE_SSIM_START", "0.55"))
LUFS_TARGET = float(os.environ.get("GATE_LUFS", "-14"))
LUFS_TOL = float(os.environ.get("GATE_LUFS_TOL", "1.5"))
TP_MAX = float(os.environ.get("GATE_TP_MAX", "-1.0"))
IMG = {".png", ".jpg", ".jpeg", ".webp"}


class Report:
    def __init__(self):
        self.lines = []
        self.blocks = 0

    def add(self, level, cid, msg):
        self.lines.append(f"{level:5} {cid}  {msg}")
        if level == "BLOCK":
            self.blocks += 1

    def ok(self, cid, msg):
        self.add("PASS", cid, msg)

    def warn(self, cid, msg):
        self.add("WARN", cid, msg)

    def block(self, cid, msg):
        self.add("BLOCK", cid, msg)

    def check(self, cond, cid, ok_msg, bad_msg):
        (self.ok if cond else self.block)(cid, ok_msg if cond else bad_msg)
        return cond


COLOR_RE = re.compile(r"빨강|빨간|붉|주황|노랑|노란|초록|녹색|파랑|파란|남색|네이비|보라|분홍|핑크|갈색|검정|검은|까만|흰|하얀|회색|은색|은테|금색|민트|베이지|카키|청색|적색|#[0-9a-fA-F]{6}")
REVIEW_LINE = re.compile(r"^REVIEWED:[ \t]+(?!<)\S+[ \t]+\d{4}-\d{2}-\d{2}", re.M)


def reviewed(path):
    """REVIEWED: <이름> <YYYY-MM-DD> 줄이 있고 자리표시자(<...>)가 아니어야 한다."""
    return path.exists() and bool(REVIEW_LINE.search(path.read_text(encoding="utf-8")))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path, entries, stream=None):
    cmd = ["ffprobe", "-v", "error"]
    if stream:
        cmd += ["-select_streams", stream]
    cmd += ["-show_entries", entries, "-of", "json", str(path)]
    p = run(cmd)
    return json.loads(p.stdout) if p.returncode == 0 and p.stdout.strip() else {}


def duration(path):
    d = probe(path, "format=duration").get("format", {}).get("duration")
    return float(d) if d else 0.0


def images(folder):
    return sorted(p for p in folder.glob("*") if p.suffix.lower() in IMG) if folder.is_dir() else []


def load_json(path, r, cid):
    if not path.exists():
        r.block(cid, f"{path.name} 없음")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        r.block(cid, f"{path.name} JSON 오류: {e}")
        return None


# ---------- 단계별 검사 ----------
def table_rows(text, heading):
    """## <heading> 아래 표의 데이터 행(머리글·구분선 제외)을 셀 목록으로 돌려준다."""
    m = re.search(rf"^##\s*{re.escape(heading)}[^\n]*\n(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    if not m:
        return None
    rows = [ln for ln in m.group(1).splitlines() if ln.strip().startswith("|")]
    out = []
    for ln in rows[2:]:
        out.append([c.strip() for c in ln.strip().strip("|").split("|")])
    return out


def g_story(root, r):
    p = root / "STORY.md"
    if not r.check(p.exists(), "S01", "STORY.md 있음", "STORY.md 없음"):
        return
    text = p.read_text(encoding="utf-8")
    left = re.findall(r"<[^>\n]{1,40}>", text)
    r.check(not left, "S02", "빈칸(<...>) 모두 채움", f"채우지 않은 빈칸 {len(left)}개: {left[:4]}")
    m = re.search(r"BPM[^\d\n]{0,12}(\d{2,3})", text)
    r.check(bool(m), "S03", f"BPM {m.group(1) if m else ''} 기록됨", "STORY.md에 음악 BPM 숫자가 없음")
    sync = table_rows(text, "음악 싱크 지점")
    ok = bool(sync) and all(len(c) > 1 and re.fullmatch(r"\d+(\.\d+)?", c[1]) for c in sync)
    r.check(ok, "S04", f"음악 싱크 지점 {len(sync or [])}행, 시간(초)이 모두 숫자", "음악 싱크 지점 표가 없거나 시간(초) 칸이 숫자가 아님")
    scenes = table_rows(text, "장면 목록")
    r.check(bool(scenes) and all(all(c for c in row) for row in scenes), "S05",
            f"장면 {len(scenes or [])}행, 빈 칸 없음", "장면 목록 표가 없거나 빈 칸이 있음")


def g_character(root, r):
    p = root / "character.txt"
    if not r.check(p.exists() and p.read_text(encoding="utf-8").strip() != "", "C01",
                   "character.txt 있음", "character.txt 없음 또는 비어 있음"):
        return
    t = p.read_text(encoding="utf-8").strip()
    bad = ("\n" in t) or t.startswith(("#", "-", "*")) or bool(re.search(r"<[^>\n]{1,40}>", t))
    r.check(not bad, "C02", "외형 고정문이 1개 문단(마크다운·빈칸 없음)", "외형 고정문에 줄바꿈, 마크다운 기호, 빈칸(<...>)이 있음 - 1개 문단 평문으로 쓸 것")
    r.check(len(t) >= 20, "C03", f"외형 고정문 {len(t)}자", "외형 고정문이 20자 미만")
    r.check(len(images(root / "sheet")) >= 1, "C04", "캐릭터 시트 이미지 있음", "sheet/ 에 캐릭터 시트 이미지 없음")
    r.check(bool(COLOR_RE.search(t)), "C05", "옷·머리 색이 적혀 있음", "외형 고정문에 색 표현이 없음 - 상의·하의 색을 적을 것")


def g_keyframes(root, r):
    ks = images(root / "key")
    if not r.check(len(ks) >= 1, "K01", f"키프레임 {len(ks)}장", "key/ 에 키프레임 없음"):
        return
    seen = {}
    for k in ks:
        seen.setdefault(hashlib.md5(k.read_bytes()).hexdigest(), []).append(k.name)
    dup = [v for v in seen.values() if len(v) > 1]
    r.check(not dup, "K02", "같은 파일 중복 없음", f"내용이 같은 키프레임 파일: {dup}")
    def aspect(path):
        st = (probe(path, "stream=width,height", "v:0").get("streams") or [{}])[0]
        return (st["width"] / st["height"]) if st.get("width") and st.get("height") else None
    bad, paired = [], 0
    for k in ks:
        c = root / "clip" / f"{k.stem}.mp4"
        if c.exists():
            paired += 1
            ak, ac = aspect(k), aspect(c)
            if ak and ac and abs(ak - ac) / ac > 0.03:
                bad.append(f"{k.name} {ak:.2f} != 클립 {ac:.2f}")
    r.check(not bad, "K03", f"짝이 있는 키프레임 {paired}장의 화면비가 클립과 같음", f"키프레임과 클립의 화면비가 다름: {bad}")
    allr = {round(aspect(k) or 0, 2) for k in ks}
    if len(allr) > 1:
        r.warn("K04", f"키프레임 화면비가 섞여 있음 {sorted(allr)} (배경 플레이트 등 의도한 것이면 무시)")


def ssim_at(clip, key, t):
    cmd = ["ffmpeg", "-hide_banner", "-v", "info", "-ss", f"{t}", "-i", str(clip), "-i", str(key),
           "-filter_complex", "[0:v]scale=320:180[a];[1:v]scale=320:180[b];[a][b]ssim",
           "-frames:v", "1", "-f", "null", "-"]
    out = run(cmd).stderr
    m = re.search(r"All:([0-9.]+)", out)
    return float(m.group(1)) if m else None


def g_clips(root, r):
    clips = sorted((root / "clip").glob("*.mp4")) if (root / "clip").is_dir() else []
    if not r.check(clips, "V01", f"클립 {len(clips)}개", "clip/ 에 mp4 없음"):
        return
    rv0 = root / "qa" / "clips-review.md"
    nk = re.search(r"^nokey:\s*(.+)$", rv0.read_text(encoding="utf-8"), re.M) if rv0.exists() else None
    nokey = {x.strip() for x in nk.group(1).split(",")} if nk else set()
    for c in clips:
        st = probe(c, "stream=nb_read_frames,r_frame_rate,width,height", "v:0")
        s = (st.get("streams") or [None])[0]
        if not r.check(s is not None, "V02", f"{c.name} 영상 스트림 있음", f"{c.name} 영상 스트림 없음"):
            continue
        d = duration(c)
        if d < 1.0 or d > 8.0:
            r.block("V03", f"{c.name} 길이 {d:.2f}초 - 1~8초 밖")
        elif d < 3.0 or d > 6.1:
            r.warn("V03", f"{c.name} 길이 {d:.2f}초 - 권장 3~6초 밖")
        else:
            r.ok("V03", f"{c.name} 길이 {d:.2f}초")
        frames = run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
                      "-show_entries", "stream=nb_read_frames", "-of", "default=nw=1:nk=1", str(c)]).stdout.strip()
        num, den = (s.get("r_frame_rate") or "30/1").split("/")
        fps = float(num) / float(den or 1)
        want = round(fps * d)
        r.check(frames.isdigit() and abs(int(frames) - want) <= 1, "V04",
                f"{c.name} 프레임 {frames}개", f"{c.name} 프레임 {frames}개, 기대 {want}개 - 끊긴 클립")
        key = next((k for k in images(root / "key") if k.stem == c.stem), None)
        if key is None:
            if c.stem in nokey:
                r.warn("V05", f"{c.name} 짝이 되는 키프레임 없음 - qa/clips-review.md 의 nokey 목록으로 허용됨")
            else:
                r.block("V05", f"{c.name} 짝이 되는 key/{c.stem}.png 없음 - 시작 화면을 검증할 수 없음 (의도한 것이면 qa/clips-review.md 에 'nokey: {c.stem}' 기록)")
            continue
        s0 = ssim_at(c, key, 0)
        if s0 is None:
            r.block("V05", f"{c.name} SSIM 측정 실패")
            continue
        r.check(s0 >= SSIM_START, "V05", f"{c.name} 시작 화면 일치 SSIM {s0:.2f}",
                f"{c.name} 시작 화면이 키프레임과 다름 SSIM {s0:.2f} < {SSIM_START}")
        worst = min([x for x in (ssim_at(c, key, t) for t in (1.0, 2.0, 3.0) if t < d - 0.2) if x is not None] or [1.0])
        r.ok("V06", f"{c.name} 뒤쪽 프레임 최저 SSIM {worst:.2f} (참고값: 움직임과 인물 변형을 구분하지 못함)")
        strip = make_strip(root, c, key, d)
        r.ok("V07", f"{c.name} 프레임 스트립 생성 -> {strip}  (키프레임, 0, 1.0, 1.5, 2.0, 3.0초 순서. 옷·안경·머리를 눈으로 비교)")
    rv = root / "qa" / "clips-review.md"
    if not r.check(reviewed(rv), "V08", "qa/clips-review.md 에 REVIEWED 기록 있음",
                   "프레임 스트립을 눈으로 본 뒤 qa/clips-review.md 에 'REVIEWED: <이름> <YYYY-MM-DD>' 줄을 적을 것"):
        return
    text = rv.read_text(encoding="utf-8")
    missing, unusable = [], []
    for c in clips:
        m = re.search(rf"^\s*{re.escape(c.stem)}\s*:\s*(ok|trim|redo|replace)\b", text, re.M)
        if not m:
            missing.append(c.stem)
        elif m.group(1) in ("redo", "replace"):
            unusable.append(f"{c.stem}={m.group(1)}")
    r.check(not missing, "V09", "모든 클립에 판정(ok/trim/redo/replace)이 있음", f"판정이 없는 클립: {missing} - '<이름>: ok|trim|redo|replace' 줄을 적을 것")
    r.check(not unusable, "V10", "다시 만들거나 교체할 클립이 남아 있지 않음", f"redo/replace 판정이 남은 클립: {unusable}")


def make_strip(root, clip, key, d):
    times = [t for t in (0, 1.0, 1.5, 2.0, 3.0) if t < d - 0.1]
    ins = ["-i", str(key)]
    for t in times:
        ins += ["-ss", f"{t}", "-i", str(clip)]
    n = len(times) + 1
    fc = ";".join(f"[{i}:v]scale=384:216[v{i}]" for i in range(n)) + ";" + "".join(f"[v{i}]" for i in range(n)) + f"hstack={n}"
    out = root / "qa" / f"strip-{clip.stem}.png"
    out.parent.mkdir(exist_ok=True)
    run(["ffmpeg", "-loglevel", "error", "-y", *ins, "-filter_complex", fc, "-frames:v", "1", str(out)])
    return out.relative_to(root)


def g_audio(root, r):
    v = load_json(root / "voices.json", r, "A01")
    if v is None:
        return
    vid = v.get("voice_id")
    r.check(bool(vid) and isinstance(vid, str) and not vid.startswith("<"), "A01", f"voice_id 1개 고정 ({vid})", "voices.json 에 voice_id 문자열이 없음")
    lines = v.get("lines") or []
    r.check(bool(lines) and all(ln.get("id") and ln.get("file") for ln in lines), "A03",
            f"대사 {len(lines)}개, 모두 id와 file이 있음", "voices.json 의 lines 가 비었거나 id/file 이 없는 대사가 있음")
    other = [ln.get("id") for ln in lines if ln.get("voice_id") not in (None, vid)]
    r.check(not other, "A02", "모든 대사가 같은 음성 ID", f"다른 음성 ID를 쓴 대사: {other}")
    for ln in lines:
        if not (ln.get("id") and ln.get("file")):
            continue
        f = root / ln["file"]
        if not f.exists():
            r.block("A04", f"대사 {ln['id']} 파일 없음: {ln['file']}")
        else:
            r.check(duration(f) > 0.2, "A04", f"대사 {ln['id']} 길이 {duration(f):.2f}초", f"대사 {ln['id']} 길이가 0에 가까움")


def g_edit(root, r):
    e = load_json(root / "edit.json", r, "B01")
    if e is None:
        return
    bpm, fps = e.get("bpm"), e.get("fps", 30)
    cuts = e.get("cuts") or []
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    valid = (num(bpm) and bpm > 0 and num(fps) and fps > 0 and bool(cuts)
             and all(isinstance(c, dict) and num(c.get("t")) and c["t"] >= 0 and num(c.get("d")) and c["d"] > 0 and isinstance(c.get("src"), str) for c in cuts))
    if not r.check(valid, "B01", f"BPM {bpm}, fps {fps}, 컷 {len(cuts)}개", "edit.json 형식 오류: bpm·fps는 양수, cuts 의 각 컷은 t>=0, d>0, src 문자열이 필요"):
        return
    cuts = sorted(cuts, key=lambda c: c["t"])
    beat = 60.0 / bpm
    half = 0.5 / fps
    bad = []
    for i, c in enumerate(cuts):
        for key, val in (("t", c["t"]), ("끝", c["t"] + c["d"])):
            q = val / beat
            if abs(q - round(q)) * beat > half + 1e-6:
                bad.append(f"컷{i+1}.{key}={val:.4f} -> {round(q)*beat:.4f}")
    r.check(not bad, "B02", "모든 컷 경계가 박 격자 위(반 프레임 이내)", f"박 격자를 벗어난 경계: {bad[:6]}")
    gaps = [f"컷{i+1}->{i+2}" for i in range(len(cuts) - 1) if abs((cuts[i]["t"] + cuts[i]["d"]) - cuts[i + 1]["t"]) * fps > 1.0]
    r.check(abs(cuts[0]["t"]) * fps <= 1.0 and not gaps, "B03", "첫 컷이 0초에서 시작하고 컷 사이에 빈틈·겹침 없음",
            f"컷 연결 오류: 첫 컷 t={cuts[0]['t']}, 어긋난 구간 {gaps} - 빈 화면 또는 겹침")
    dup = subprocess.run([sys.executable, str(Path(__file__).resolve().parent.parent / "scripts" / "dupcheck.py"), str(root / "edit.json")],
                         capture_output=True, text=True)
    r.check(dup.returncode == 0, "B04", "반복 컷 없음", "반복 컷: " + dup.stdout.strip().replace("\n", " / ")[:200])
    vj = load_json(root / "voices.json", Report(), "-") or {}
    ids = {ln.get("id"): ln for ln in (vj.get("lines") or [])}
    for c in cuts:
        ln = c.get("line")
        if not ln:
            continue
        if ln not in ids:
            r.block("B05", f"컷 line '{ln}' 이 voices.json 에 없음")
            continue
        dur = duration(root / ids[ln].get("file", ""))
        r.check(dur <= c["d"] + 0.01, "B05", f"대사 {ln} {dur:.2f}초 <= 컷 {c['d']:.2f}초", f"대사 {ln} {dur:.2f}초가 컷 {c['d']:.2f}초보다 김 - 입 모양이 잘림")
    clip_dir = root / "clip"
    if not clip_dir.is_dir():
        r.warn("B06", "clip/ 폴더가 없어 src 클립 파일과 사용 구간 검사를 건너뜀")
    else:
        for c in cuts:
            m = re.fullmatch(r"clip:([^@]+)@([0-9.]+)", c["src"])
            if not m:
                r.block("B06", f"src 형식 오류 '{c['src']}' (clip:<이름>@<시작초>)")
                continue
            f = clip_dir / f"{m.group(1)}.mp4"
            if not f.exists():
                r.block("B06", f"src 클립 파일 없음: clip/{m.group(1)}.mp4")
                continue
            need = float(m.group(2)) + c["d"] * float(c.get("rate", 1.0))
            have = duration(f)
            r.check(need <= have + 0.05, "B06", f"{f.name} 사용 구간 {need:.2f}초 <= 클립 {have:.2f}초",
                    f"{f.name} 은 {have:.2f}초인데 컷이 {need:.2f}초 지점까지 사용함 - 클립이 모자람")


def g_final(root, r):
    f = root / "out" / "final.mp4"
    if not r.check(f.exists(), "F01", "out/final.mp4 있음", "out/final.mp4 없음"):
        return
    e = (load_json(root / "edit.json", Report(), "-") or {})
    fps = e.get("fps", 30)
    cuts = e.get("cuts", [])
    secs = max((c["t"] + c["d"] for c in cuts), default=None)
    v = (probe(f, "stream=codec_type,width,height,r_frame_rate,duration").get("streams") or [])
    vid = next((s for s in v if s.get("codec_type") == "video"), {})
    aud = next((s for s in v if s.get("codec_type") == "audio"), None)
    if secs:
        got = run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                   "stream=nb_read_frames", "-of", "default=nw=1:nk=1", str(f)]).stdout.strip()
        r.check(got.isdigit() and int(got) == round(fps * secs), "F02", f"프레임 {got}개 = {fps}fps x {secs:.2f}초",
                f"프레임 {got}개, 기대 {round(fps*secs)}개 - 렌더가 끊겼거나 길이가 다름")
    r.check(aud is not None, "F03", "오디오 스트림 있음", "오디오 스트림 없음")
    wh = (vid.get("width"), vid.get("height"))
    want = (e.get("width", 1920), e.get("height", 1080))
    r.check(wh == want, "F04", f"해상도 {wh}", f"해상도 {wh}, 기대 {want}")
    num, den = (vid.get("r_frame_rate") or "0/1").split("/")
    got_fps = float(num) / float(den or 1)
    r.check(abs(got_fps - fps) < 0.01, "F08", f"fps {got_fps:g}", f"fps {got_fps:g}, edit.json 은 {fps}")
    if aud is not None:
        vd, ad = float(vid.get("duration") or 0), float(aud.get("duration") or 0)
        r.check(abs(vd - ad) <= 0.1 and (not secs or abs(ad - secs) <= 1.5 / fps + 0.05), "F09",
                f"오디오 {ad:.2f}초, 영상 {vd:.2f}초", f"오디오 {ad:.2f}초와 영상 {vd:.2f}초가 맞지 않음 - 오디오가 일찍 끝나거나 길이가 다름")
    out = run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    seg = out[out.rfind("Summary"):]
    li = re.search(r"I:\s+(-?[0-9.]+) LUFS", seg)
    tp = re.search(r"Peak:\s+(-?[0-9.]+) dBFS", seg)
    if li and tp:
        r.check(abs(float(li.group(1)) - LUFS_TARGET) <= LUFS_TOL, "F05", f"라우드니스 {li.group(1)} LUFS",
                f"라우드니스 {li.group(1)} LUFS, 목표 {LUFS_TARGET} ± {LUFS_TOL}")
        r.check(float(tp.group(1)) <= TP_MAX, "F06", f"true peak {tp.group(1)} dBFS", f"true peak {tp.group(1)} dBFS > {TP_MAX}")
    else:
        r.block("F05", "라우드니스 측정 실패(오디오 없음?)")
    rv = root / "qa" / "review.md"
    ok = reviewed(rv) and len([ln for ln in rv.read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("REVIEWED:")]) >= 1
    r.check(ok, "F07", "qa/review.md 에 REVIEWED 줄과 본 결과가 있음",
            "컨택트 시트를 눈으로 본 뒤 qa/review.md 에 'REVIEWED: <이름> <YYYY-MM-DD>' 줄과, 아래에 본 결과(한 줄 이상)를 적을 것")
    r.check(rv.exists() and rv.stat().st_mtime >= f.stat().st_mtime, "F10", "검수 기록이 최종본보다 나중에 작성됨",
            "qa/review.md 가 out/final.mp4 보다 오래됨 - 최종본을 다시 렌더했다면 다시 보고 기록할 것")


STAGES = {"story": g_story, "character": g_character, "keyframes": g_keyframes,
          "clips": g_clips, "audio": g_audio, "edit": g_edit, "final": g_final}


def main(argv):
    if len(argv) < 2 or argv[1] not in (*STAGES, "all"):
        print(__doc__)
        return 2
    label = argv[2] if len(argv) > 2 else "."
    root = Path(label).resolve()
    names = list(STAGES) if argv[1] == "all" else [argv[1]]
    total_blocks = 0
    for name in names:
        r = Report()
        STAGES[name](root, r)
        body = f"== gate {name} ({label})\n" + "\n".join(r.lines) + f"\n== {'BLOCK' if r.blocks else 'PASS'} {name}: BLOCK {r.blocks}개\n"
        print(body, end="")
        (root / "qa").mkdir(exist_ok=True)
        (root / "qa" / f"gate-{name}.txt").write_text(body, encoding="utf-8")
        total_blocks += r.blocks
    return 1 if total_blocks else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
