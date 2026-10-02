#!/usr/bin/env bash
# 완성 영상을 믿지 말고 측정한다: 스트림 정보, 프레임 수, 반복 프레임, 라우드니스, 컨택트 시트, 받아쓰기.
# 사용법: verify.sh <video.mp4> [언어=ko] [whisper 모델=small]
# 끝나면 <video>.contact.png (0.5초당 1칸)를 직접 눈으로 확인하세요. 겹침, 사라진 글자, 이상한 소품은 시트에서만 보입니다.
set -uo pipefail
v=${1:?usage: verify.sh video.mp4 [lang] [model]}; lang=${2:-ko}; model=${3:-small}
base=${v%.*}
echo "== ffprobe"; ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames,duration -of csv=p=0 "$v"
echo "== decoded frames: $(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$v")"
echo "== loudness (I 와 True peak 를 확인)"
ffmpeg -hide_banner -i "$v" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E 'I:|Peak:'
secs=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
cols=9; tiles=$(python3 -c "import math;print(math.ceil($secs*2))"); rows=$(python3 -c "import math;print(math.ceil($tiles/$cols))")
ffmpeg -loglevel error -y -i "$v" -vf "fps=2,scale=320:180,tile=${cols}x${rows}" -frames:v 1 "$base.contact.png" && echo "== contact sheet: $base.contact.png"
if command -v whisper >/dev/null; then
  tmp=$(mktemp -d); ffmpeg -loglevel error -y -i "$v" -vn -ac 1 -ar 16000 "$tmp/a.wav"
  echo "== transcript ($model, $lang) - 대본과 비교하세요"
  timeout 900 whisper "$tmp/a.wav" --model "$model" --language "$lang" --output_format txt --output_dir "$tmp" --fp16 False >/dev/null 2>&1 && cat "$tmp/a.txt" || echo "(whisper 실패 또는 시간 초과)"
else
  echo "== whisper 미설치: 받아쓰기 생략 (pip install openai-whisper)"
fi
