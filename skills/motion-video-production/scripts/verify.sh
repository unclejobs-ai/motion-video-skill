#!/usr/bin/env bash
# 기존 진입점: 미디어 검사는 gate.py 한 곳에서 하고 결과를 한 표로 남긴다.
# 사용법: [PRODUCTION=productions/<id>] verify.sh <video.mp4> [--project <폴더>] [--plan <계획.json> --src <원본.mp4>] [--all]
set -euo pipefail
SKILL_ROOT=$(cd "$(dirname "$0")/.." && pwd)
v=${1:?usage: verify.sh video.mp4 [verify options]}; shift
if [[ -n "${PRODUCTION:-}" ]]; then set -- --production "$PRODUCTION" "$@"; fi
exec node "$SKILL_ROOT/engines/remotion/pipeline/verify.mjs" --skill-root "$SKILL_ROOT" --video "$v" "$@"
