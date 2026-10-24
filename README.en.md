<p>
  <img src="docs/assets/logo.svg" width="80" height="80" alt="Motion Video Production logo" />
</p>

# motion-video-production

[한국어](README.md) · **English**

A **production skill in the Agent Skills format** for making motion graphics, promo and character videos (15–90 seconds) from start to finish. Codex, Claude Code, and other skill-capable runtimes use the same skill folder.
Gates (`harness/gate.py`) measure the outputs of each stage and report pass or fail through exit codes. A reference-video analyzer and two ready-to-render engines (Remotion, HyperFrames) ship with it.

**Jump to** · [Installation](#installation) · [60-second start](#60-second-start) · [What the full version adds](#what-the-full-version-adds) · [Reference analysis](#reference-analysis) · [Workflow](#workflow) · [Harness](#harness) · [Tools](#required-tools) · [Verification scope](#verification-scope)

---

## Installation

### Shared installation (Codex, Claude Code, other runtimes)

Run this in the project folder where you want to use the skill. It requires Node.js and npx; select the runtimes you use.

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production
```

To target Codex only, run the command below. Add `--global` for personal scope.

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production --agent codex
```

The [Vercel skills CLI](https://github.com/vercel-labs/skills) handles install locations for Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode, Amp, Antigravity, Windsurf, and others. The engines live inside the skill folder, so they install with it. **Installer compatibility is not the same as full video-production validation.** See [runtime installation, invocation, and verification scope](docs/runtimes.md).

<details>
<summary><strong>Manual installation (without Node.js)</strong></summary>

Codex reads skills from project `.agents/skills/` and personal `~/.agents/skills/`. This example is a personal installation.

```bash
git clone https://github.com/unclejobs-ai/motion-video-skill.git
mkdir -p ~/.agents/skills
cp -r motion-video-skill/skills/motion-video-production ~/.agents/skills/
```

Claude Code reads skills from project `.claude/skills/` and personal `~/.claude/skills/`. The existing installation commands still work.

```bash
git clone https://github.com/unclejobs-ai/motion-video-skill.git
mkdir -p ~/.claude/skills
cp -r motion-video-skill/skills/motion-video-production ~/.claude/skills/
```

To use it in one project only, copy the same folder into that project's runtime skill directory. Do not install the same name through several paths in one runtime.

</details>

### First request

After installation, confirm that `motion-video-production` appears in the runtime's skill list. If it does not, restart the runtime. Invoke it with `$motion-video-production` in Codex or `/motion-video-production` in Claude Code and Cursor, or ask:

> I want a 20-second promo video that feels like this reference video.

The agent first asks six things (publication type, length and aspect ratio, available tools, prohibited elements, reference video, engine) and proceeds stage by stage. Without generation tools, it hands you prompts and continues from the files you generate.

## 60-second start

Copy an engine out of the installed skill into a working folder and render a demo. Node.js 24 or newer and ffmpeg are required. Never install inside the skill folder.

```bash
SKILL_ROOT="$PWD/.agents/skills/motion-video-production"   # your actual install path
cp -R "$SKILL_ROOT/engines/remotion" engine && cd engine && npm ci
node pipeline/probe.mjs productions/carry-demo              # carry 1.00 PASS
node pipeline/render.mjs carry-demo --stills 1.5 3.0        # renders/carry-demo/contact.png
node pipeline/render.mjs carry-demo                         # renders/carry-demo/picture.mp4
node pipeline/score.mjs productions/carry-demo              # procedural score
bash "$SKILL_ROOT/scripts/mix-mux.sh" renders/carry-demo/picture.mp4 60 5 productions/carry-demo/audio/score.wav - out/final.mp4
bash "$SKILL_ROOT/scripts/verify.sh" out/final.mp4
```

Rendering uses `CHROME_PATH` or a cached Playwright headless shell. If neither exists, `npx remotion browser ensure` downloads one (ask first).

## What the full version adds

| What | What it does | Where |
|---|---|---|
| Remotion engine | Pinned render pipeline, motion modules, demos | `engines/remotion/` |
| Carry oracle | Measures, before rendering, whether something on screen survives each boundary | `pipeline/carry.ts`, `probe.mjs` |
| Wordcut template | One word held in one slot while scenes hand it over. Edit only `data.ts` | `productions/wordcut/` |
| Look fit | Fits lens values to a reference's contrast, colour, grain and depth of field | `look-fit.mjs` |
| Voice and music | ElevenLabs and Fish Audio voices via the composio CLI, a procedural score on the timing | `vo.mjs`, `score.mjs` |
| HyperFrames engine | Animates plain HTML/CSS pages with GSAP and renders them to mp4 | `engines/hyperframes/` |
| Reference analysis | Takes a reference video apart with OpenCV into target numbers | `scripts/ref-analyze.py` |

The engine is swappable. Use Remotion when you need carry and wordcut, HyperFrames when the source material is web pages. The comparison is in [`references/engines.md`](skills/motion-video-production/references/engines.md).

## Reference analysis

![Reference analysis pipeline](docs/assets/ref-pipeline.png)

"Make it like this video" is usually about motion and editing more than texture. Stage 0 takes the reference apart with OpenCV and records cuts and holds, optical flow, blur, depth of field, grain and look as numbers. The plan cites those numbers. After rendering, the same analysis measures the result, and `gate.py ref` lists target and difference per metric and blocks when one is out of range.

```bash
python3 -I "$SKILL_ROOT/scripts/ref-analyze.py" reference.mp4 -o ref/analysis.json --targets ref/targets.json
python3 "$SKILL_ROOT/harness/gate.py" ref .
```

Motion is measured per 1/30 s, so different frame rates compare. The reference file is never committed; only the numbers are kept. Metric explanations and a worked example are in [`references/reference-analysis.md`](skills/motion-video-production/references/reference-analysis.md).

## Workflow

![Production stages and their gates](docs/assets/workflow-ref.png)

1. The skill creates the stage outputs (`ref/`, `STORY.md`, `character.txt`, `key/`, `clip/`, `voices.json`, `edit.json`).
2. Set `SKILL_ROOT` to the parent folder of the installed `SKILL.md` and `PROJECT_ROOT` to the output folder. After each stage, run `python3 "$SKILL_ROOT/harness/gate.py" <stage> "$PROJECT_ROOT"`.
3. Exit code 0 moves to the next stage. Exit code 1 (BLOCK) means: read the BLOCK lines in `qa/gate-<stage>.txt`, fix the output, and rerun the same gate.
4. Checks that need human eyes cannot be judged by a script. They pass only with a record written after looking at the frames (`qa/clips-review.md`, `qa/review.md`).

### Gate demo

A `gate.py clips` run. Without a visual review record it returns BLOCK (exit code 1); after the record is written it returns PASS (exit code 0).

![gate clips run: BLOCK, visual review record, PASS](docs/assets/gate-demo.gif)

## Harness

![How gates work: automated measurement, visual review, record files](docs/assets/harness.png)

| Production stage | Gate | Checks |
|---|---|---|
| 0. Reference analysis | `ref` | Before planning: blanks in ANALYSIS.md, targets.json format. After rendering: each metric against its target |
| 1. Story and scene planning | `story` | Blanks, BPM, music sync table, scene table |
| 2. Character sheet | `character` | Whether `character.txt` is one paragraph, color descriptions, sheet image |
| 3. Keyframes | `keyframes` | Duplicate files, aspect ratio against clips |
| 4. Video conversion | `clips` | Duration, frame count, start-frame match, frame strip, per-clip verdicts |
| 5. Music and voice | `audio` | One voice ID, dialogue files |
| 6. Assembly | `edit`, `final` | Beat grid, cut continuity, repeated cuts, dialogue length, frame count, audio, loudness, true peak, review record |

Gates measure only the finished mp4, so the standard is the same whichever engine made it.

### Frame strips

Some clips match the keyframe at the start, then change the person after one or two seconds. `gate clips` builds an image per clip with the keyframe and frames at 0, 1.0, 1.5, 2.0, and 3.0 seconds in one row.

![Frame strip example](docs/assets/strip.png)

Similarity values such as SSIM cannot tell a person's motion from deformation (`gotchas.md` G02). The gate checks only the start-frame match numerically and asks a person to review and record the later frames.

### Harness check

From the repository folder, run `bash skills/motion-video-production/harness/selftest.sh`. To check an installed copy, run `bash "$SKILL_ROOT/harness/selftest.sh"`. Exit code 0 means the cases behave as expected on this computer.

## Seven consistency criteria

Where the seven criteria that keep faces and voices consistent across scenes sit in the production stages is shown below and in `references/consistency-7.md`.

![Where the seven consistency criteria sit](docs/assets/seams.png)

## Gotchas

All 29 are in [`references/gotchas.md`](skills/motion-video-production/references/gotchas.md) with symptoms, causes, prevention, and check IDs. Engine pitfalls are in [`references/pitfalls.md`](skills/motion-video-production/references/pitfalls.md). Common ones:

- A clip can match its start frame and still change clothes, glasses, or hair one or two seconds later. (G01)
- Set cut lengths in beats, and round start frames once from cumulative time. (G11, G12)
- Measure dialogue length before setting cut length. (G13)
- Piping a check through `| tail` loses its exit code. (G21)
- A smooth scene change where nothing survives still scores carry 0.00. Move one element across the boundary.

## Required tools

Free tiers and commercial-use conditions are in `NOTICE.md` and `references/licensing.md` (with source URLs). Remotion needs a Company License for for-profit organizations with four or more employees; HyperFrames is Apache-2.0. Terms change often, so check them right before work.

| Tool | Purpose |
|---|---|
| Codex, Claude Code, or another skill-capable agent | Running production and assembly |
| ffmpeg, ffprobe, Python 3, Bash | Running the harness and scripts (WSL on Windows) |
| Node.js 24 or newer | Engines (Remotion 4.0.529, HyperFrames 0.8.143, pinned) |
| OpenCV, numpy (`requirements-ref.txt`) | Reference analysis |
| ChatGPT / Grok Imagine | Image and video generation |
| ElevenLabs, Fish Audio (composio CLI) | Voice |
| whisper | Transcription review |

## Repository structure

```
README.md, README.en.md     Korean and English READMEs
NOTICE.md, LICENSE          External tool notice, MIT
docs/                       README images (diagram SVG sources included), runtime install and verification scope
skills/motion-video-production/        Skill folder to install (everything below is copied together)
  SKILL.md                  Skill instructions
  references/               reference analysis, engines, art direction, consistency, beat grid, tool notes, gotchas, licensing
  harness/                  gate.py (per-stage verdicts), selftest.sh (harness self-validation)
  scripts/                  ref-analyze.py, mix-mux.sh, verify.sh, key-plate.sh, clipsheet.sh and more
  templates/                ANALYSIS.md, STORY.md, BEATSHEET.md, MUSIC_BRIEF.md and more
  engines/remotion/         carry demo, wordcut template, render, voice and score pipeline
  engines/hyperframes/      HTML/GSAP carry demo
```

## Verification scope

On 2026-10-25 the committed tree was exported and installed as is. All 76 skill files installed. Engine `npm ci`, typecheck, 13 tests, the carry probe and the selftest passed. Renders in both engines were measured with `verify.sh` and `gate.py ref`, and the HyperFrames render passed `gate.py final`. Not checked: external generation, voice credits, listening to audio, and invocation inside the seven other runtimes. Details are in [docs/runtimes.md](docs/runtimes.md).

## Known limitations

- **The carry probe is Remotion-only.** It reads the boxes declared before rendering (`track.ts`). HyperFrames renders are measured on the mp4 with `verify.sh`, `gate.py final` and `gate.py ref`. There is no mp4-side carry measurement yet.
- **The wordcut demo is an untuned first render.** Against the reference targets, `gate.py ref` blocks 10 of 12 metrics; grain, sharpness ratio and contrast are furthest off. Re-running `look-fit.mjs` and `plan.mjs` to close that gap is how the skill is meant to be used.
- **A closing image lowers the carry score to 0.50 (WARN).** The boundary where the image covers the page counts as bare. If the score drops below 0.5, turn another boundary into a carry.
- **The full text of the GSAP license clauses was not verified.** GSAP 3.14.2, used by the HyperFrames demo, says in its README that it is free including commercial use. Check https://gsap.com/standard-license yourself before publishing.

## Built by

This skill distills the review criteria the team behind [SceneSteller](https://www.scenesteller.com/?utm_source=github&utm_medium=readme&utm_campaign=motion-video-skill) built up while producing videos. If you'd rather go from story to finished video right in your browser, try it in SceneSteller.

## Rights and responsibilities

Rights and responsibilities for generated outputs are described in `NOTICE.md` and `references/licensing.md`.
