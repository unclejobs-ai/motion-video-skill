# README assets

## Editable diagrams

`ref-pipeline`, `workflow-ref`, `harness`, `seams`, and `strip` each have Korean (`.svg`) and English (`.en.svg`) sources. The paired layouts match. The four vertical diagrams retain the type, colors, grid, and arrow style from `d8b8b44`. Orange marks gate names and BLOCK messages only.

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

- `carry-demo.png` is the quick-start result contact sheet: the existing carry-demo stills at 1.5 and 3.0 seconds, scaled to 480×270 and placed left to right. The demo's Korean typography is real rendered content, not a translated diagram. It is five seconds long and the quick start adds music, not voice.
- To reproduce it, run the README's `node pipeline/render.mjs carry-demo --stills 1.5 3.0` in the copied Remotion engine, then copy `renders/carry-demo/contact.png` here as `carry-demo.png`.
- `strip-frames.png` preserves only the six image tiles from the previous `strip.png` at `cd1e75b`. Crop: 3036×280 at (82, 180), resized to 1518×140. No new character footage was generated. The strip is a QA example, not the quick-start result.
- `strip.svg` and `strip.en.svg` reference that shared image. Keep it beside them when exporting. Both PNGs are 1600 pixels wide; labels and captions are 64 pixels in the exported PNG (32 pixels at an 800-pixel README width).
- `gate-demo.gif` is unchanged real gate output in Korean. Both READMEs keep it next to the strip; the English caption identifies the output language.
