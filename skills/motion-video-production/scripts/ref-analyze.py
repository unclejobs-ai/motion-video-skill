#!/usr/bin/env python3
"""레퍼런스 영상을 OpenCV로 분해해 숫자 하나의 JSON으로 남긴다. 편집 리듬, 움직임, 블러, 심도, 그레인, 질감.

사용법:
  python3 -I ref-analyze.py <video.mp4> [-o analysis.json] [--targets targets.json]
  -o        분석 결과 JSON (기본: 표준 출력)
  --targets 이 분석을 목표값으로 삼는 targets.json 도 함께 쓴다 (gate.py ref 가 읽는다)
의존: scripts/requirements-ref.txt (opencv-python-headless, numpy, 정확한 버전 고정)

모든 프레임은 짧은 변을 540px로 줄인 뒤 잰다(크기가 다른 영상끼리 비교할 수 있게). 지표의 뜻과 고칠 방향은
references/reference-analysis.md 에 있다. 영상과 프레임은 저장하지 않는다. 숫자만 남긴다.
"""
import argparse
import json
import sys

import cv2
import numpy as np

SHORT = 540          # 분석 해상도: 짧은 변
FLOW_SHORT = 270     # 광학 흐름 해상도: 짧은 변 (속도 때문에 절반)
PER = 30.0           # 움직임 지표의 시간 단위: 1/30초. fps가 다른 영상끼리 비교할 수 있게 프레임당 값에 fps/PER를 곱한다
STILL_DIFF = 1.0     # 1/30초당 평균 밝기 차(0-255)가 이보다 작으면 정지 프레임
CUT_CORR = 0.6       # HSV 히스토그램 상관이 이보다 낮으면 컷(장 바뀜)
CUT_DIFF = 25.0      # 또는 프레임 사이 평균 밝기 차가 이보다 크면 컷 (컷은 한 프레임에 일어나므로 정규화하지 않는다)
HOLD_MIN = 0.25      # 이 길이(초) 이상 이어진 정지 구간만 홀드로 센다
TRANSITION = 0.25    # 컷 앞뒤 이 길이(초)를 전환 구간으로 보고 흐름을 잰다
LOOK_EVERY = 0.5     # 질감 지표는 이 간격(초)마다 한 프레임


def resize_short(img, short):
    h, w = img.shape[:2]
    s = short / min(h, w)
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)


def hist(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
    return cv2.normalize(h, h).flatten()


def lap_var(y):
    return float(cv2.Laplacian(y, cv2.CV_64F).var()) if y.size else 0.0


def look(bgr):
    """look.mjs 와 같은 여섯 숫자: 심도 비, 대비, 채도, 색 농도, 검정 수준, 그레인."""
    y = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    h = y.shape[0]
    edge = (lap_var(y[: h // 4]) + lap_var(y[3 * h // 4 :])) / 2
    mid = lap_var(y[h // 4 : 3 * h // 4])
    f = bgr.astype(np.float64)
    mx, mn = f.max(axis=2), f.min(axis=2)
    sat = float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean())
    return {
        "sharpRatio": edge / mid if mid else 0.0,
        "rms": float(y.std() / 255),
        "sat": sat,
        "chroma": float(((mx - mn) / 255).mean()),
        "black": float(np.percentile(y, 1)),
        "grain": grain(y),
    }


def grain(y):
    """가장 평평한 20% 8x8 블록에서 고주파(밝기 - 3x3 평균)의 표준편차 중앙값."""
    hp = y - cv2.blur(y, (3, 3))
    smooth = cv2.blur(y, (5, 5))
    h, w = y.shape
    hb, wb = h // 8, w // 8
    blocks = lambda a: a[: hb * 8, : wb * 8].reshape(hb, 8, wb, 8).swapaxes(1, 2).reshape(hb * wb, 64)
    flat = blocks(smooth).var(axis=1)
    noise = np.sqrt((blocks(hp) ** 2).mean(axis=1))
    keep = noise[np.argsort(flat)[: max(1, round(len(flat) * 0.2))]]
    return float(np.median(keep))


def dof_bands(y, n=5):
    """위에서 아래로 n개 띠의 라플라시안 분산을 가장 선명한 띠로 나눈 값. 1 = 가장 선명."""
    h = y.shape[0]
    v = [lap_var(y[i * h // n : (i + 1) * h // n]) for i in range(n)]
    top = max(v) or 1.0
    return [round(x / top, 4) for x in v]


def autocorr_len(hp, axis):
    """고주파 밝기의 축 방향 자기상관이 0.5 아래로 떨어지는 첫 지연(px). 번짐이 길수록 길다."""
    a = hp - hp.mean()
    var = (a * a).mean() or 1.0
    for lag in range(1, 41):
        c = (a[:, lag:] * a[:, :-lag]).mean() if axis == 1 else (a[lag:, :] * a[:-lag, :]).mean()
        if c / var < 0.5:
            return lag
    return 40


def direction(fx, fy, mag):
    """크기로 가중한 흐름 방향 히스토그램의 최빈 방향(도, 0 = 오른쪽, 90 = 아래)."""
    ang = np.degrees(np.arctan2(fy, fx).astype(np.float64)) % 360
    bins = (np.floor((ang + 22.5) / 45).astype(int) % 8).ravel()
    return int(np.bincount(bins, weights=mag.ravel(), minlength=8).argmax() * 45)


def analyze(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise SystemExit(f"cannot open {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    diffs, corrs, flow, dirs, looks, dofs = [], [], [], [], [], []
    blur_along, blur_across = [], []
    prev = prev_small = prev_hist = None
    i = 0
    look_step = max(1, round(fps * LOOK_EVERY))
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        bgr = resize_short(frame, SHORT)
        y = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        small = resize_short(y, FLOW_SHORT)
        h = hist(bgr)
        if prev is not None:
            diffs.append(float(cv2.absdiff(y, prev).mean()))
            corrs.append(float(cv2.compareHist(prev_hist, h, cv2.HISTCMP_CORREL)))
            f = cv2.calcOpticalFlowFarneback(prev_small, small, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag = np.hypot(f[..., 0], f[..., 1])
            # 흐름 해상도의 px/frame 을 분석 해상도(짧은 변 540) 기준으로 환산
            flow.append(float(mag.mean()) * SHORT / FLOW_SHORT)
            dirs.append(direction(f[..., 0], f[..., 1], mag))
        if i % look_step == 0:
            looks.append(look(bgr))
            dofs.append(dof_bands(y.astype(np.float64)))
        if flow and flow[-1] * fps / PER > 4:  # 4 px per 1/30 s
            hp = y.astype(np.float64) - cv2.blur(y.astype(np.float64), (9, 9))
            horiz = dirs[-1] % 180 in (0, 45, 135)
            blur_along.append(autocorr_len(hp, 1 if horiz else 0))
            blur_across.append(autocorr_len(hp, 0 if horiz else 1))
        prev, prev_small, prev_hist = y, small, h
        i += 1
    cap.release()
    n = i
    if n == 0:
        raise SystemExit(f"no decodable frames in {path}")
    seconds = n / fps
    norm = fps / PER
    raw_diffs = diffs
    diffs = [d * norm for d in raw_diffs]
    flow = [x * norm for x in flow]

    # 컷: 프레임 k (k = 1..n-1) 가 앞 프레임과 다른 장면
    cut_frames = [k + 1 for k, (d, c) in enumerate(zip(raw_diffs, corrs)) if c < CUT_CORR or d > CUT_DIFF]
    merged = []
    for k in cut_frames:  # 연속 프레임 컷(와이프·휙 넘김)은 첫 프레임 하나로 합친다
        if not merged or k - merged[-1] > max(2, round(fps * 0.1)):
            merged.append(k)
    cuts = [round(k / fps, 3) for k in merged]
    bounds = [0.0, *cuts, seconds]
    shots = [round(b - a, 3) for a, b in zip(bounds, bounds[1:]) if b > a]
    shot_mean = float(np.mean(shots)) if shots else 0.0
    shot_cv = float(np.std(shots) / shot_mean) if shot_mean else 0.0

    still = [d < STILL_DIFF for d in diffs]
    holds, run = [], 0
    for s in still + [False]:
        if s:
            run += 1
        else:
            if run / fps >= HOLD_MIN:
                holds.append(round(run / fps, 3))
            run = 0

    win = max(1, round(TRANSITION * fps))
    transitions = []
    for k in merged:
        a, b = max(0, k - 1 - win), min(len(flow), k - 1 + win)
        seg = flow[a:b]
        if not seg:
            continue
        peak = int(np.argmax(seg))
        moving = [x for x in seg if x > 2]  # 2 px per 1/30 s
        transitions.append({
            "t": round(k / fps, 3),
            "peakFlow": round(float(seg[peak]), 2),
            "dir": dirs[a + peak],
            "movingS": round(len(moving) / fps, 3),
        })

    lk = {key: round(float(np.mean([l[key] for l in looks])), 4) for key in looks[0]} if looks else {}
    return {
        "source": {"width": W, "height": H, "fps": round(fps, 3), "frames": n, "seconds": round(seconds, 3)},
        "analysisShortSide": SHORT,
        "edit": {
            "cuts": cuts,
            "cutCount": len(cuts),
            "cutsPerMin": round(len(cuts) / seconds * 60, 2) if seconds else 0,
            "shots": shots,
            "shotMeanS": round(shot_mean, 3),
            "shotCV": round(shot_cv, 3),
            "holds": holds,
            "holdMeanS": round(float(np.mean(holds)), 3) if holds else 0.0,
            "holdLongestS": max(holds) if holds else 0.0,
            "stillShare": round(sum(still) / len(still), 4) if still else 0.0,
            "meanDiff": round(float(np.mean(diffs)), 3) if diffs else 0.0,
        },
        "motion": {
            "meanFlow": round(float(np.mean(flow)), 3) if flow else 0.0,
            "p90Flow": round(float(np.percentile(flow, 90)), 3) if flow else 0.0,
            "dominantDir": int(np.bincount([d // 45 for d in dirs], weights=flow, minlength=8).argmax() * 45) if dirs else 0,
            "transitions": transitions,
            "transitionPeakMean": round(float(np.mean([t["peakFlow"] for t in transitions])), 3) if transitions else 0.0,
            "transitionMovingMeanS": round(float(np.mean([t["movingS"] for t in transitions])), 3) if transitions else 0.0,
        },
        "blur": {
            "framesMeasured": len(blur_along),
            "alongPx": round(float(np.median(blur_along)), 2) if blur_along else 0.0,
            "acrossPx": round(float(np.median(blur_across)), 2) if blur_across else 0.0,
            "anisotropy": round(float(np.median(blur_along) / max(1.0, np.median(blur_across))), 3) if blur_along else 1.0,
        },
        "dof": {"bands": [round(float(np.mean([d[b] for d in dofs])), 4) for b in range(5)] if dofs else [], "sharpRatio": lk.get("sharpRatio", 0.0)},
        "grain": lk.get("grain", 0.0),
        "look": lk,
        "units": "motion and meanDiff are per 1/30 s at the 540 px short side; times in seconds",
        "thresholds": {"stillDiff": STILL_DIFF, "cutCorr": CUT_CORR, "cutDiff": CUT_DIFF, "holdMinS": HOLD_MIN, "transitionS": TRANSITION, "lookEveryS": LOOK_EVERY},
    }


# gate.py ref 가 비교하는 지표와 기본 허용 오차(목표 대비 비율). 경로는 analysis JSON 안의 위치.
TARGET_METRICS = {
    "edit.shotMeanS": 0.25,
    "edit.shotCV": 0.35,
    "edit.stillShare": 0.25,
    "edit.meanDiff": 0.35,
    "edit.holdMeanS": 0.35,
    "motion.meanFlow": 0.35,
    "motion.transitionPeakMean": 0.35,
    "blur.alongPx": 0.5,
    "look.sharpRatio": 0.25,
    "look.rms": 0.15,
    "look.chroma": 0.25,
    "look.grain": 0.35,
}


def pick(d, path):
    for k in path.split("."):
        d = d[k]
    return d


def targets(analysis):
    return {"metrics": {p: {"target": pick(analysis, p), "tol": tol} for p, tol in TARGET_METRICS.items()}}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("video")
    ap.add_argument("-o", "--out")
    ap.add_argument("--targets")
    a = ap.parse_args()
    result = analyze(a.video)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text + "\n")
    else:
        print(text)
    if a.targets:
        open(a.targets, "w", encoding="utf-8").write(json.dumps(targets(result), ensure_ascii=False, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
