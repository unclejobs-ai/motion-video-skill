#!/usr/bin/env bash
# 클립의 모든 프레임을 6x5 타일 시트(JPG)로 뽑아 눈으로 검수한다.
# 사용법: clipsheet.sh <클립.mp4> [출력폴더=qa/sheets]
# 시트 N번의 칸 위치 = 프레임 번호 (N-1)*30 + 행*6 + 열.
set -euo pipefail
clip=${1:?usage: clipsheet.sh <clip.mp4> [outdir]}
out=${2:-qa/sheets}
id=$(basename "${clip%.*}")
mkdir -p "$out"
ffmpeg -v error -y -i "$clip" -vf "scale=384:-2,tile=6x5:padding=2" -fps_mode passthrough "$out/${id}_%02d.jpg"
ls "$out/${id}_"*.jpg | wc -l
