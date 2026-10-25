# README assets

## Editable diagrams

`ref-pipeline`, `workflow-ref`, `harness`, `seams`, and `strip` each have Korean (`.svg`) and English (`.en.svg`) sources. The paired layouts match. The four vertical diagrams retain the type, colors, grid, and arrow style from `d8b8b44`. Orange marks gate names and BLOCK messages only. Both READMEs display the four vertical diagrams at 480 pixels wide. Reference-flow steps are unnumbered; workflow stages use 0–6. The harness table owns the gate-name column, and the consistency map shows only stages with applicable criteria.

Export at 2x with librsvg, from the repository root:

```bash
for name in ref-pipeline workflow-ref harness seams strip; do
  for lang in '' .en; do
    rsvg-convert --zoom 2 "docs/assets/$name$lang.svg" -o "docs/assets/$name$lang.png"
  done
done
```

Fonts: Noto Sans KR (fallback: Apple SD Gothic Neo) and IBM Plex Mono (fallback: SFMono-Regular). Font availability can change text metrics; inspect both language exports after editing.

## Result and frame-strip sources

- `carry-demo.gif` is the five-second quick-start render at 15 fps and 720 pixels wide, looping without audio. Export from the copied Remotion engine: `ffmpeg -i renders/carry-demo/picture.mp4 -vf "fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 carry-demo.gif`, then copy it here. Both READMEs embed this moving result.
- `carry-demo.png` remains the quick-start result contact sheet: the existing carry-demo stills at 1.5 and 3.0 seconds, scaled to 480×270 and placed left to right. The demo's Korean typography is real rendered content, not a translated diagram. It is five seconds long and the quick start adds music, not voice.
- To reproduce it, run the README's `node pipeline/render.mjs carry-demo --stills 1.5 3.0` in the copied Remotion engine, then copy `renders/carry-demo/contact.png` here as `carry-demo.png`.
- `strip-frames.png` preserves only the six image tiles from the previous `strip.png` at `cd1e75b`. Crop: 3036×280 at (82, 180), resized to 1518×140. No new character footage was generated. The strip is a QA example, not the quick-start result.
- `strip.svg` and `strip.en.svg` crop six separate tiles from that shared image. Keep it beside them when exporting. Both PNGs are 1600×420; labels are 36 pixels in the export (18 pixels at an 800-pixel README width). A 32-pixel gap after the keyframe becomes 16 pixels at that display width. The explanatory caption lives only in the README, not the image.
- `gate-demo.gif` is unchanged real gate output in Korean. Both READMEs keep it next to the strip; the English caption identifies the output language.
