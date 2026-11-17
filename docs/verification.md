# How results are verified

The stage gate remains the source of truth. The Remotion pipeline's `verify.mjs` adds one ordered table around it, not another implementation of frame counts or loudness. It also works on HyperFrames output. No render, dependency install, transcription or paid call runs during verification.

## Run

From any directory, using the actual installed skill path:

```bash
bash "$SKILL_ROOT/scripts/verify.sh" "$PROJECT_ROOT/out/final.mp4" --project "$PROJECT_ROOT"
# Inspect the LOOK images and play the cuts and audio. Record the actual review, then:
python3 "$SKILL_ROOT/harness/gate.py" final "$PROJECT_ROOT"
```

From a copied Remotion engine:

```bash
npm run verify -- --production productions/carry-demo --video renders/carry-demo/final.mp4 --skill-root "$SKILL_ROOT"
```

The video must already exist and include the final mix. `--project` reads the expected length, fps and dimensions from that project's `edit.json`. `--production` reads its declared `track.ts` for carry and media expectations. When both are given, the project's edit contract wins for media. Without either, frame count is compared only to the stream header; target resolution and fps are SKIP. That cannot detect a shortened file whose header also changed.

## The table

| Order | Checks | Default |
|---|---|---|
| 0 | Engine tests, including synthetic timeline cases | enforce |
| 1 | Carry; optional overlay joins, card holds and chapter bridges | carry enforce; new timeline checks observe |
| 2 | Decoded frames, audio stream, resolution, fps, A/V length | existing gate checks enforce; new nominal/average rate comparison observe |
| 3 | Integrated loudness and true peak | existing gate checks enforce |
| 4 | Optional picture samples near joins, compared with bare footage | observe |
| 5 | Contact sheet (at most 60 tiles) and last frame | LOOK, never PASS |

New checks start in **observe**: a failure becomes WARN without changing the exit code. Promote them only after checking false positives on representative work. Modes and new thresholds live in `skills/motion-video-production/engines/remotion/pipeline/verify-limits.json`. Existing media calculations and audio limits stay in `harness/gate.py`: −14 ±1.5 LUFS, true peak ≤ −1 dBTP, A/V difference ≤0.1 s. Existing `GATE_LUFS`, `GATE_LUFS_TOL` and `GATE_TP_MAX` overrides still apply. Private-engine audio profiles and mix changes were not imported.

An enforced failure exits 1 and stops after its cost tier; `--all` continues through all tiers. Invalid inputs exit 2. WARN and SKIP are not proof that a check passed. `qa/VERIFY.md` beside the video records the command, commit, table, and video mtime/size. Re-run after re-encoding. It does not replace `qa/review.md`: the final gate still requires a real, fresh human review.

`--plan <json>` enables pure overlay checks: no exposed gap under 2 s, cards at most 9 s, no source pause stacked with a held card, and chapter bridges at least 3.5 s. `--src <footage.mp4>` additionally compares join windows in a one-chapter plan at 344×216 gray, warning above 18 dB PSNR. See the installed [plan schema and commands](../skills/motion-video-production/references/verification.md). Actual compositor rows are preferable; a calculated plan only verifies a render if the compositor uses those same rows.

## What remains human or unmeasured

Inspect text clipping, overlaps, identity drift and the final frame. Play the cuts and listen to the mix. Whether a shot fits the words or the music feels balanced is not a numerical verdict. Never write a review for frames or audio you did not inspect. After three failed fix attempts on the same check, report what was tried and what still fails.

Picture sampling does not cover every frame. Windows crossing inserted source pauses are skipped and counted; multiple chapters need separate one-chapter checks. Cropping or retiming the source invalidates the comparison. Nominal/average frame-rate comparison is not a full timestamp scan. Short-shot detection, section-by-section music levels and render determinism are not included.

The previous shell verifier's informational checksum repeats, edge RGB samples and automatic Whisper call are no longer run. Check moving repeats in playback/strips and compare a separate transcript to the script when needed.

## Test the checks

No npm install is needed:

```bash
bash skills/motion-video-production/harness/selftest.sh
(cd skills/motion-video-production/engines/remotion && npm test)
```

Selftest includes the existing synthetic media defects, timeline editor tests, skill path/name checks, engine tests and small generated-video tests of the table/wrapper and copied engine. Fixtures contain no real production media. A synthetic selftest is not end-to-end validation of a generated video or of every supported agent runtime.
