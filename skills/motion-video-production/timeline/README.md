# Timeline editor

See the finished edit as four tracks (picture, text, voice, music), change it in the browser, and build the mp4 again. The agent edits the same file through the same core, so the person and the agent never work on two copies.

```bash
node "$SKILL_ROOT/timeline/serve.mjs" "$PROJECT_ROOT"          # opens http://127.0.0.1:4321/
node "$SKILL_ROOT/timeline/apply.mjs" "$PROJECT_ROOT"          # print the timeline and its problems
node "$SKILL_ROOT/timeline/apply.mjs" "$PROJECT_ROOT" ops.json # agent edit (or - for stdin)
node "$SKILL_ROOT/timeline/build.mjs" "$PROJECT_ROOT" [--burn] # edit.json -> out/final.mp4
```

Needs Node.js 24+ and ffmpeg. No `npm install`. The page loads Pretendard and JetBrains Mono from jsDelivr and falls back to system fonts offline.

## In the editor

| Do | How |
|---|---|
| Play, scrub | Space, click or drag the ruler |
| Move the cut point between two shots | Drag the line between them. Cuts stay back to back; the right shot keeps showing the same moment of its source |
| Move or trim text and sound | Drag the body; drag an edge |
| Edit a caption | Double-click it, or type in the inspector |
| Add a caption | T (at the playhead) |
| Gain, fades, ducking | Inspector, with a sound selected |
| Nudge | ← → by a frame, Shift by a beat |
| Snap | On by default: item edges and the playhead within 8 px, otherwise the beat. S toggles, Alt bypasses |
| Undo, redo | ⌘Z, ⇧⌘Z |
| Zoom | ⌘ or Ctrl + wheel |

Every change is saved to `edit.json` at once; the first save of a session copies the original to `qa/timeline/`. The pill in the top bar runs the same timing checks as the edit gate (beat grid, contiguous cuts, a line inside its cut) plus file-length checks, and the item at fault gets an orange outline. **Run gate** runs `gate.py edit`; **Build mp4** runs `build.mjs`.

If someone else changes `edit.json` while the editor is open (the agent, a text editor), the editor reloads within two seconds. If both change it at once, the editor's change is refused (revision conflict) and the editor shows the current file.

## edit.json

The gates read `bpm`, `fps`, `width`, `height` and `cuts`. The editor adds two optional tracks the gates ignore.

```json
{
  "bpm": 96, "fps": 30, "width": 1280, "height": 720,
  "cuts": [
    { "t": 0, "d": 5, "src": "clip:01@0" },
    { "t": 5, "d": 5, "src": "clip:02@0.5", "line": "n1" }
  ],
  "text": [
    { "t": 5.625, "d": 2.5, "text": "Gather it, and it fits on one page." }
  ],
  "audio": [
    { "id": "music", "kind": "music", "file": "audio/score.wav", "t": 0, "d": 10, "gain": -6, "fadeOut": 1.875 },
    { "id": "n1", "kind": "voice", "file": "vo/n1.wav", "t": 5.625, "d": 2.4 }
  ]
}
```

- `cuts[].src` is `clip:<name>@<second>` (`clip/<name>.mp4`) or `file:<path>@<second>` for any video in the project, such as an engine render.
- `audio[]`: `t` where it starts on the timeline, `in` where it starts in the file, `d` how long, `gain` in dB (−60 to 12), `fadeIn` and `fadeOut` in seconds, `duck: false` to keep music at full level under voice. A voice item's `id` matches its line id in `voices.json`, and a cut's `line` names it.
- Items get ids (`c1`, `t1`, `a1`) the first time they are saved. Times are seconds.

## Ops (agents)

`apply.mjs` takes a JSON array. The batch is applied all or nothing, and the editor's undo uses the inverse ops the core returns.

```json
[
  { "op": "update", "track": "text", "id": "t1", "patch": { "text": "New line", "t": 6.25 } },
  { "op": "update", "track": "audio", "id": "music", "patch": { "gain": -9 } },
  { "op": "create", "track": "text", "item": { "t": 10.625, "d": 2.5, "text": "Second line" } },
  { "op": "delete", "track": "text", "id": "t3" }
]
```

A patch field set to `null` removes it. Shape errors (a missing file name, gain out of range) refuse the batch; timing problems come back as BLOCK and WARN lines so a half-finished edit can be saved.

## Limits

- Preview plays the clips and sounds as they are, with the same gains and fades; it does not apply the build's loudness normalization, and ducking is approximated.
- Text is plain captions. Styled on-screen type belongs in the engine (Remotion or HyperFrames); render it, then place the render as a `file:` cut.
- Burning captions into the picture needs an ffmpeg with libass (`--burn`). Without it, the text goes in as a subtitle track and `out/captions.srt`.
- Cuts can be re-timed but not reordered or added in the editor yet; ask the agent (one `create` or `update` op).
