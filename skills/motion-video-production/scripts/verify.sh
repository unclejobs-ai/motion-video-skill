#!/usr/bin/env bash
# 완성 영상을 믿지 말고 측정한다: 스트림 정보, 프레임 수, 반복 프레임, 라우드니스, 컨택트 시트, 프레임 가장자리 색, 받아쓰기.
# 사용법: [PRODUCTION=productions/<id>] verify.sh <video.mp4> [언어=ko] [whisper 모델=small]
# PRODUCTION을 주면 엔진 폴더(현재 폴더)의 pipeline/probe.mjs로 carry 검사를 먼저 돌리고, 종료 코드는 그 판정을 따릅니다.
# 끝나면 <video>.contact.png (0.5초당 1칸)를 직접 눈으로 확인하세요. 겹침, 사라진 글자, 이상한 소품은 시트에서만 보입니다.
set -uo pipefail
v=${1:?usage: verify.sh video.mp4 [lang] [model]}; lang=${2:-ko}; model=${3:-small}
base=${v%.*}
verdict=0
if [[ -n "${PRODUCTION:-}" ]]; then node pipeline/probe.mjs "$PRODUCTION"; verdict=$?; fi
echo "== ffprobe"; ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames,duration -of csv=p=0 "$v"
echo "== decoded frames: $(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$v")"
echo "== repeated frames (앞 프레임과 같은 프레임. 정지 구간은 괜찮고, 움직이는 중의 반복은 끊김)"
ffmpeg -loglevel error -i "$v" -map 0:v -f framemd5 - | python3 -c '
import sys
rows = [[s.strip() for s in l.split(",")] for l in sys.stdin.read().splitlines() if l and not l.startswith("#")]
rep = run = longest = at = 0
for i, r in enumerate(rows):
    if i and r[5] == rows[i - 1][5]:
        rep += 1; run += 1
        if run > longest: longest, at = run, i - run
    else: run = 0
print(f"{rep} of {len(rows)} frames repeat the previous one; longest hold {longest + (1 if longest else 0)} frames from frame {at}")
'
echo "== loudness (I 와 True peak 를 확인)"
ffmpeg -hide_banner -i "$v" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E 'I:|Peak:'
secs=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
cols=9; tiles=$(python3 -c "import math;print(math.ceil($secs*2))"); rows=$(python3 -c "import math;print(math.ceil($tiles/$cols))")
ffmpeg -loglevel error -y -i "$v" -vf "fps=2,scale=320:-2,tile=${cols}x${rows}" -frames:v 1 "$base.contact.png" && echo "== contact sheet: $base.contact.png"
echo "== frame edges (위 아래 왼쪽 오른쪽 평균 RGB, 10개 시점. 흔들기 이음매는 한쪽 가장자리 색이 달라져서 보입니다)"
for i in 1 2 3 4 5 6 7 8 9 10; do
  t=$(python3 -c "print(f'{$secs*$i/11:.2f}')"); printf "%6s: " "$t"
  for c in "iw:1:0:0" "iw:1:0:ih-1" "1:ih:0:0" "1:ih:iw-1:0"; do
    ffmpeg -loglevel error -ss "$t" -i "$v" -frames:v 1 -vf "format=rgb24,crop=$c,scale=1:1:flags=area" -f rawvideo -pix_fmt rgb24 - | xxd -p | tr '\n' ' '
  done; echo
done
# 받아쓰기: WHISPER_GGML이 ggml 모델을 가리키면 whisper.cpp(빠름). 단어 시작 시각은 openai-whisper --word_timestamps로 잽니다.
tmp=$(mktemp -d); ffmpeg -loglevel error -y -i "$v" -vn -ac 1 -ar 16000 "$tmp/a.wav"
if [[ -n "${WHISPER_GGML:-}" && -f "$WHISPER_GGML" ]] && command -v whisper-cli >/dev/null; then
  echo "== transcript (whisper.cpp $(basename "$WHISPER_GGML"), $lang) - 대본과 비교하세요"
  timeout 300 whisper-cli -m "$WHISPER_GGML" -l "$lang" -f "$tmp/a.wav" -otxt -of "$tmp/a" -np >/dev/null 2>&1 && cat "$tmp/a.txt" || echo "(whisper-cli 실패 또는 시간 초과)"
elif command -v whisper >/dev/null; then
  echo "== transcript ($model, $lang) - 대본과 비교하세요"
  timeout 900 whisper "$tmp/a.wav" --model "$model" --language "$lang" --output_format txt --output_dir "$tmp" --fp16 False >/dev/null 2>&1 && cat "$tmp/a.txt" || echo "(whisper 실패 또는 시간 초과)"
else
  echo "== whisper 미설치: 받아쓰기 생략 (pip install openai-whisper)"
fi
exit $verdict
