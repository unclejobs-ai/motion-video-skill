# README assets

## Diagrams

`hero`, `carry`, `workflow`, `gate`, `reference`, `consistency` and `strip` are rendered from the HTML sources in [`../diagrams/`](../diagrams/). Each source holds its English and Korean strings; `name.png` is English (used by `README.md`) and `name.ko.png` is Korean (used by `README.ko.md`). `skills/motion-video-production/references/assets/ref-pipeline.png` is a copy of `reference.ko.png`, because the skill's reference docs are Korean.

The diagrams follow the Uncle Jobs design system:

- Paper (`#fafaf7`) or ink (`#0a0a09`) ground, one orange accent (`#ff5a14`, `#b83802` for small text on paper). In every diagram the accent marks one thing, usually the BLOCK loop.
- Pretendard for text, JetBrains Mono for paths, numbers and code. Hierarchy comes from size, weight and space; structure from 2px hairlines and 3px rules.
- Hand-drawn lines through rough.js 4.6.6 (`sketch.js`): roughness 1.3, bowing 1.2, hachure gap 11, fixed seeds so re-renders do not move. Only lines wobble; text stays in HTML.
- Real frames, not decoration: every image in a diagram is a frame from the carry demo or the QA strip.

Edit the HTML, then render from the repository root (needs Chrome and network for the fonts and rough.js on jsDelivr):

```bash
bash docs/diagrams/render.sh            # all diagrams, English and Korean
bash docs/diagrams/render.sh workflow   # one diagram
```

Each page declares its size in `<meta name="size">`. If the content is taller, the script still renders a full-height image for a look and exits 1, so fix the size or the layout before committing.

## Frames used inside the diagrams

- `diagrams/img/carry-1.5.png`, `carry-1.9.png`, `carry-3.0.png`: frames of `carry-demo.gif` at those times (`ffmpeg -ss <t> -i carry-demo.gif -frames:v 1`). The boxes in `carry.html` are the first line's ink boxes from `productions/carry-demo/track.ts`, scaled to the thumbnail.
- `diagrams/img/strip-frames.png`: the six tiles of the earlier QA strip (`cd1e75b`, crop 3036×280 at (82, 180), resized to 1518×140). No new character footage was generated. `strip-key.png` and `strip-1.0.png` are its first and third tiles.

## Result animations

- `carry-demo.gif` is the five-second quick-start render at 15 fps and 720 pixels wide, looping without audio. Export from the copied Remotion engine: `ffmpeg -i renders/carry-demo/picture.mp4 -vf "fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 carry-demo.gif`.
- `gate-demo.gif` is real `gate.py clips` output in Korean. Both READMEs keep it next to the strip; the English caption names the output language.
