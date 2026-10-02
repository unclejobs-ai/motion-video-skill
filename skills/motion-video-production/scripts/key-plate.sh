#!/usr/bin/env bash
# 초록 배경 클립을 투명 PNG 시퀀스(c_0001.png ...)로 만든다 (캐릭터만 합성할 때 사용).
# 사용법: key-plate.sh <clip.mp4> <출력폴더> [키색=0x00B140] [유사도=0.24] [블렌드=0.08] [마스크]
#   마스크(선택): "N0-N1:X0,Y0,X1,Y1" -> 프레임 N0..N1 동안 그 사각형을 투명 처리 (영상 모델이 만든 불필요한 소품 제거용)
# 브랜드 색(민트/청록)이 지워지는 것을 막으려고 YUV chromakey 대신 RGB colorkey를 씁니다.
set -euo pipefail
clip=${1:?usage: key-plate.sh <clip.mp4> <outDir> [key] [sim] [blend] [mask]}
out=${2:?outDir}
key=${3:-0x00B140}; sim=${4:-0.24}; blend=${5:-0.08}; mask=${6:-}
mkdir -p "$out"
if [[ -z "$mask" ]]; then
  ffmpeg -loglevel error -y -i "$clip" -vf "colorkey=${key}:${sim}:${blend}" -c:v png "$out/c_%04d.png"
else
  range=${mask%%:*}; rect=${mask##*:}; n0=${range%-*}; n1=${range#*-}
  IFS=, read -r x0 y0 x1 y1 <<< "$rect"
  ffmpeg -loglevel error -y -i "$clip" -vf "colorkey=${key}:${sim}:${blend},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(between(N,${n0},${n1})*between(X,${x0},${x1})*between(Y,${y0},${y1}),0,alpha(X,Y))'" -c:v png "$out/c_%04d.png"
fi
n=$(ls "$out"/c_*.png | wc -l | tr -d ' ')
echo "keyed $n frames -> $out"
first=$(printf "%s/c_%04d.png" "$out" $(( (n + 1) / 2 )))
ffmpeg -loglevel error -y -f lavfi -i color=c=0x1D1D1F:s=1280x720 -f lavfi -i color=c=0xFFFFFF:s=1280x720 -i "$first" \
  -filter_complex "[2]split[a][b];[0][a]overlay[x];[1][b]overlay[y];[x][y]hstack,scale=1600:-1" -frames:v 1 "$out/_keycheck.png"
echo "어두운 배경/밝은 배경 위 합성 확인: $out/_keycheck.png 를 눈으로 보세요"
