#!/usr/bin/env bash
# 배경음악 + 대사 트랙을 섞고(대사가 나올 때 음악을 낮춤) 영상에 입힌다.
# 프레임 수가 기대값과 같을 때만 mux 합니다 (렌더가 중간에 끊긴 영상이 성공처럼 보이는 것을 막는 게이트).
# 사용법: mix-mux.sh <picture.mp4> <fps> <초> <music.wav> <vo_track.wav|-> <out.mp4> [목표LUFS=-14]
set -euo pipefail
picture=${1:?usage: mix-mux.sh picture fps seconds music vo|- out [lufs]}; fps=$2; secs=$3; music=$4; vo=$5; out=$6; lufs=${7:--14}
expected=$(python3 -c "print(round($fps*$secs))")
have=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$picture")
if [[ "$have" != "$expected" ]]; then
  echo "ABORT: 영상 프레임 $have 개, 기대값 $expected 개 - 다시 렌더하세요" >&2; exit 1
fi
mkdir -p "$(dirname "$out")"; mix="$(dirname "$out")/mix.wav"
if [[ "$vo" == "-" ]]; then
  ffmpeg -loglevel error -y -i "$music" -af "loudnorm=I=${lufs}:TP=-1.5:LRA=9" -ar 48000 -ac 2 "$mix"
else
  ffmpeg -loglevel error -y -i "$music" -i "$vo" -filter_complex \
    "[1]asplit=2[vo][key];[0][key]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=250:makeup=1[duck];[duck][vo]amix=inputs=2:normalize=0:weights='1 1.15',loudnorm=I=${lufs}:TP=-1.5:LRA=9[m]" \
    -map "[m]" -ar 48000 -ac 2 "$mix"
fi
ffmpeg -loglevel error -y -i "$picture" -i "$mix" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -t "$secs" -movflags +faststart "$out"
echo "muxed $out ($have frames, ${secs}s)"
