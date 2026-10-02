#!/usr/bin/env bash
# 하네스 자체 검증: 합성 프로젝트로 gate.py가 "통과해야 할 것은 통과시키고 막아야 할 것은 막는지" 확인한다.
# 사용법: bash harness/selftest.sh      종료 코드 0 = 전부 기대대로, 1 = 하나라도 어긋남
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
GATE=(python3 "$HERE/gate.py")
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
fails=0

ff() { ffmpeg -loglevel error -y "$@" || { echo "fixture 생성 실패: $*" >&2; exit 1; }; }

make_base() { # $1 = 폴더. 클립·키프레임 이름은 edit.json 의 clip ID(01, 02)와 같다.
  local P=$1; mkdir -p "$P"/{sheet,key,clip,audio,out,qa}
  ff -f lavfi -i testsrc2=s=640x360:d=1 -frames:v 1 "$P/key/01.png"
  ff -f lavfi -i smptebars=s=640x360:d=1 -frames:v 1 "$P/key/02.png"
  cp "$P/key/01.png" "$P/sheet/sheet.png"
  ff -loop 1 -framerate 30 -i "$P/key/01.png" -t 4 -pix_fmt yuv420p "$P/clip/01.mp4"
  ff -loop 1 -framerate 30 -i "$P/key/02.png" -t 4 -pix_fmt yuv420p "$P/clip/02.mp4"
  ff -f lavfi -i "sine=f=300:d=1.5" "$P/audio/n1.wav"
  cat > "$P/STORY.md" <<'EOF'
# 시험 작품 (길이 4초, 2컷)
- 공개 방식: 비공개 시안
- 음악 BPM: 144
## 음악 싱크 지점
| 이름 | 시간(초) | 설명 |
|---|---|---|
| 드롭 | 1.7 | 전환 |
## 장면 목록
| 시간 | 이야기 | 행동 1개 | 키프레임 | 클립 |
|---|---|---|---|---|
| 0.0 - 1.67 | 첫 장면 | 손을 든다 | 01 | 01 |
| 1.67 - 4.17 | 둘째 장면 | 고개를 돌린다 | 02 | 02 |
EOF
  echo "둥근 안경을 쓴 주황색 비니 차림의 남자, 검은 후드와 갈색 머리, 짧은 수염, 30대 체형" > "$P/character.txt"
  echo '{"voice_id":"VOICE-1","lines":[{"id":"n1","file":"audio/n1.wav","text":"안녕"}]}' > "$P/voices.json"
  cat > "$P/edit.json" <<'EOF'
{"fps":30,"width":1920,"height":1080,"bpm":144,"cuts":[
 {"t":0.0,"d":1.6667,"src":"clip:01@0.0","line":"n1"},
 {"t":1.6667,"d":2.5,"src":"clip:02@0.0"}]}
EOF
  ff -f lavfi -i testsrc2=s=1920x1080:r=30 -f lavfi -i "sine=f=440:d=5" -frames:v 125 -af "loudnorm=I=-14:TP=-1.5:LRA=9" \
     -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$P/out/final.mp4"
  sleep 1
  printf 'REVIEWED: selftest 2026-10-02\n01: ok\n02: ok\n' > "$P/qa/clips-review.md"
  printf 'REVIEWED: selftest 2026-10-02\n컨택트 시트 10칸 확인, 겹침·사라진 글자 없음\n' > "$P/qa/review.md"
}

expect() { # $1 이름  $2 기대 종료코드  $3 단계  $4 폴더  [$5 BLOCK 으로 나와야 할 검사 ID]
  local name=$1 want=$2 stage=$3 dir=$4 id=${5:-}
  local out; out=$("${GATE[@]}" "$stage" "$dir" 2>&1); local got=$?
  local ok=1
  [[ $got -eq $want ]] || ok=0
  [[ -z $id ]] || grep -q "^BLOCK $id" <<<"$out" || ok=0
  if (( ok )); then echo "ok   $name"; else echo "FAIL $name (종료 코드 $got, 기대 $want ${id:+/ $id})"; echo "$out" | sed 's/^/     /'; fails=$((fails+1)); fi
}

mut() { # $1 복사본 이름  -> 정상 프로젝트를 복사하고 경로를 돌려준다
  local B="$W/$1"; cp -R "$W/good" "$B"; echo "$B"
}

make_base "$W/good"
for s in story character keyframes audio edit clips final; do expect "정상 프로젝트 - $s" 0 "$s" "$W/good"; done

# ---- story
B=$(mut story_bad); sed -i.bak 's/음악 BPM: 144/음악 BPM: <000>/' "$B/STORY.md"; expect "STORY 빈칸 남음" 1 story "$B" S02
B=$(mut story_sync); sed -i.bak 's/| 드롭 | 1.7 | 전환 |/| 드롭 | 나중에 | 전환 |/' "$B/STORY.md"; expect "음악 싱크 시간이 숫자가 아님" 1 story "$B" S04
B=$(mut story_scene); sed -i.bak '/둘째 장면/d; s/| 0.0 - 1.67 | 첫 장면 | 손을 든다 | 01 | 01 |/| 0.0 - 1.67 | | 손을 든다 | 01 | 01 |/' "$B/STORY.md"; expect "장면 표에 빈 칸" 1 story "$B" S05
# ---- character
B=$(mut char_md); printf '# 캐릭터\n- 갈색 머리\n' > "$B/character.txt"; expect "character.txt 가 마크다운" 1 character "$B" C02
B=$(mut char_color); echo "둥근 안경을 쓴 비니 차림의 남자, 후드와 머리 모양이 평범한 30대 체형" > "$B/character.txt"; expect "외형 고정문에 색이 없음" 1 character "$B" C05
B=$(mut char_blank); printf '   \n' > "$B/character.txt"; expect "공백뿐인 character.txt" 1 character "$B" C01
# ---- keyframes
B=$(mut dup_key); cp "$B/key/01.png" "$B/key/02.png"; expect "중복 키프레임" 1 keyframes "$B" K02
B=$(mut aspect); ff -f lavfi -i testsrc2=s=360x640:d=1 -frames:v 1 "$B/key/02.png"; expect "키프레임 화면비가 클립과 다름" 1 keyframes "$B" K03
# ---- clips
B=$(mut wrongstart); cp "$B/clip/02.mp4" "$B/clip/01.mp4"; expect "키프레임에서 시작하지 않는 클립" 1 clips "$B" V05
B=$(mut nokey); cp "$B/clip/01.mp4" "$B/clip/extra.mp4"; expect "짝이 되는 키프레임이 없는 클립" 1 clips "$B" V05
B=$(mut nokey_ok); cp "$B/clip/01.mp4" "$B/clip/extra.mp4"; printf 'REVIEWED: selftest 2026-10-02\n01: ok\n02: ok\nextra: ok\nnokey: extra\n' > "$B/qa/clips-review.md"; expect "nokey 로 허용한 클립" 0 clips "$B"
B=$(mut noclipreview); rm "$B/qa/clips-review.md"; expect "클립 검수 기록 없음" 1 clips "$B" V08
B=$(mut review_blank); printf 'REVIEWED:\n' > "$B/qa/clips-review.md"; expect "빈 REVIEWED 줄" 1 clips "$B" V08
B=$(mut review_ph); printf 'REVIEWED: <이름> <날짜>\n01: ok\n02: ok\n' > "$B/qa/clips-review.md"; expect "자리표시자 REVIEWED 줄" 1 clips "$B" V08
B=$(mut review_noverdict); printf 'REVIEWED: selftest 2026-10-02\n01: ok\n' > "$B/qa/clips-review.md"; expect "클립 판정이 빠짐" 1 clips "$B" V09
B=$(mut review_redo); printf 'REVIEWED: selftest 2026-10-02\n01: ok\n02: redo\n' > "$B/qa/clips-review.md"; expect "redo 판정이 남음" 1 clips "$B" V10
B=$(mut short); ff -loop 1 -framerate 30 -i "$B/key/01.png" -t 0.5 -pix_fmt yuv420p "$B/clip/01.mp4"; expect "너무 짧은 클립" 1 clips "$B" V03
# ---- audio
B=$(mut voice); echo '{"voice_id":"V1","lines":[{"id":"n1","voice_id":"V2","file":"audio/n1.wav"}]}' > "$B/voices.json"; expect "대사마다 다른 음성 ID" 1 audio "$B" A02
B=$(mut nolines); echo '{"voice_id":"V1"}' > "$B/voices.json"; expect "대사 목록 없음" 1 audio "$B" A03
B=$(mut noid); echo '{"voice_id":"V1","lines":[{"file":"audio/n1.wav"}]}' > "$B/voices.json"; expect "대사에 id 없음" 1 audio "$B" A03
# ---- edit
B=$(mut grid); sed -i.bak 's/"d":1.6667/"d":1.7/; s/"t":1.6667/"t":1.7/' "$B/edit.json"; expect "박 격자를 벗어난 컷 경계" 1 edit "$B" B02
B=$(mut gap); sed -i.bak 's/"t":1.6667/"t":2.5/; s/"d":2.5/"d":1.6667/' "$B/edit.json"; expect "컷 사이 빈틈" 1 edit "$B" B03
B=$(mut gapstart); sed -i.bak 's/"t":0.0,"d":1.6667/"t":0.4167,"d":1.25/; s/"t":1.6667/"t":1.6667/' "$B/edit.json"; expect "첫 컷 앞 빈 구간" 1 edit "$B" B03
B=$(mut order); python3 - "$B/edit.json" <<'EOF'
import json,sys; p=sys.argv[1]; e=json.load(open(p)); e["cuts"].reverse(); e["cuts"][0]["line"]=None; json.dump(e,open(p,"w"))
EOF
expect "순서가 뒤바뀐 컷은 정렬해서 정상 판정" 0 edit "$B"
B=$(mut repeat); sed -i.bak 's/clip:02@0.0/clip:01@0.0/' "$B/edit.json"; expect "같은 클립을 두 컷에 사용" 1 edit "$B" B04
B=$(mut lip); ff -f lavfi -i "sine=f=300:d=2.4" "$B/audio/n1.wav"; expect "대사가 컷보다 김" 1 edit "$B" B05
B=$(mut lineid); sed -i.bak 's/"line":"n1"/"line":"zz"/' "$B/edit.json"; expect "컷 line 이 voices.json 에 없음" 1 edit "$B" B05
B=$(mut nosrc); rm "$B/clip/02.mp4"; expect "src 클립 파일 없음" 1 edit "$B" B06
B=$(mut overrun); sed -i.bak 's/clip:02@0.0/clip:02@2.5/' "$B/edit.json"; expect "클립 길이보다 뒤까지 사용" 1 edit "$B" B06
B=$(mut zero); sed -i.bak 's/"d":2.5/"d":0/' "$B/edit.json"; expect "길이 0인 컷" 1 edit "$B" B01
B=$(mut bpmstr); sed -i.bak 's/"bpm":144/"bpm":"144"/' "$B/edit.json"; expect "bpm 이 문자열" 1 edit "$B" B01
# ---- final
B=$(mut noreview); rm "$B/qa/review.md"; expect "최종본 검수 기록 없음" 1 final "$B" F07
B=$(mut review_empty); printf 'REVIEWED: selftest 2026-10-02\n' > "$B/qa/review.md"; expect "본 결과가 없는 REVIEWED" 1 final "$B" F07
B=$(mut review_old); touch -t 202001010000 "$B/qa/review.md"; expect "검수 기록이 최종본보다 오래됨" 1 final "$B" F10
B=$(mut trunc); ff -i "$W/good/out/final.mp4" -t 3 -c copy "$B/out/final.mp4"; sleep 1; touch "$B/qa/review.md"; expect "렌더가 끊긴 최종본" 1 final "$B" F02
B=$(mut loud); ff -i "$W/good/out/final.mp4" -af "volume=12dB" -c:v copy "$B/out/final.mp4"; sleep 1; touch "$B/qa/review.md"; expect "라우드니스 초과" 1 final "$B" F05
B=$(mut shortaudio); ff -i "$W/good/out/final.mp4" -t 2 -vn -af "loudnorm=I=-14:TP=-1.5:LRA=9" "$B/a.m4a"; ff -i "$W/good/out/final.mp4" -i "$B/a.m4a" -map 0:v -map 1:a -c:v copy -c:a aac "$B/out/final.mp4"; sleep 1; touch "$B/qa/review.md"; expect "오디오가 일찍 끝남" 1 final "$B" F09
B=$(mut fps25); ff -i "$W/good/out/final.mp4" -vf fps=25 -c:a copy "$B/out/final.mp4"; sleep 1; touch "$B/qa/review.md"; expect "fps 가 edit.json 과 다름" 1 final "$B" F08
B=$(mut silent); ff -i "$W/good/out/final.mp4" -an -c:v copy "$B/out/final.mp4"; sleep 1; touch "$B/qa/review.md"; expect "오디오 없는 최종본" 1 final "$B" F03

# ---- 회귀: ICC 프로파일이 붙은 클립도 프레임 수를 읽는다 (PIL 필요, 없으면 건너뜀)
if python3 -c "import PIL" 2>/dev/null; then
  B=$(mut icc); mkdir -p "$B/_f"
  python3 - "$B/_f" <<'EOF'
import sys
from PIL import Image, ImageCms
p = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
for i in range(120):
    Image.new("RGB", (640, 360), (i * 2 % 255, 90, 40)).save(f"{sys.argv[1]}/f{i:03d}.jpg", icc_profile=p)
EOF
  ff -framerate 30 -i "$B/_f/f%03d.jpg" -c:v libx264 -pix_fmt yuv420p "$B/clip/01.mp4"
  out=$("${GATE[@]}" clips "$B" 2>&1)
  if grep -q "^PASS  V04  01.mp4 프레임 120개" <<<"$out"; then echo "ok   ICC 프로파일 클립의 프레임 수를 120개로 읽음"; else echo "FAIL ICC 프로파일 클립의 프레임 수 읽기"; echo "$out" | sed 's/^/     /'; fails=$((fails+1)); fi
else
  echo "skip ICC 회귀 사례 (PIL 없음)"
fi

echo "-- 셀프테스트 실패 $fails 건"
(( fails == 0 ))
