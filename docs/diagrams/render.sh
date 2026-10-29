#!/usr/bin/env bash
# Render every docs/diagrams/*.html to docs/assets/<name>.png (English) and <name>.ko.png (Korean)
# with headless Chrome. Needs network for rough.js and the fonts (jsDelivr).
# Usage, from the repository root: bash docs/diagrams/render.sh [name ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "set CHROME to a Chrome or Chromium binary" >&2; exit 1; }

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  for f in docs/diagrams/*.html; do names+=("$(basename "$f" .html)"); done
fi

fail=0
for name in "${names[@]}"; do
  src="docs/diagrams/$name.html"
  size=$(sed -n 's/.*<meta name="size" content="\([0-9]*x[0-9]*\)".*/\1/p' "$src")
  [ -n "$size" ] || { echo "$src: missing <meta name=\"size\" content=\"WxH\">" >&2; exit 1; }
  for lang in en ko; do
    out="docs/assets/$name.png"; [ "$lang" = en ] || out="docs/assets/$name.$lang.png"
    # --dump-dom prints the title, which the page sets to OVERFLOW when content is taller than the size
    state=$("$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=15000 \
      --window-size="${size/x/,}" --dump-dom "file://$PWD/$src?lang=$lang" 2>/dev/null | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' || true)
    shot="$size"
    if [ "$state" != done ]; then
      echo "$name ($lang): $state, set <meta name=size> to fit; rendered at full height for a look" >&2
      fail=1; h="${state#OVERFLOW }"; [ -n "$state" ] && [ "$h" != "$state" ] || exit 1; shot="${size%x*}x$h"
    fi
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=15000 \
      --window-size="${shot/x/,}" --force-device-scale-factor=1 --screenshot="$PWD/$out" \
      "file://$PWD/$src?lang=$lang" >/dev/null 2>&1
    echo "$out ($shot)"
  done
done
exit $fail
