# motion-video-production

[한국어](README.md) | [English](README.en.md)

A **Claude Code skill** with a workflow and review criteria for producing motion graphics and videos (30–90 seconds) from start to finish.
It includes a validation script (`harness/gate.py`, referred to below as the gate) that measures the outputs of each of the six production stages and reports pass or fail through exit codes, plus prevention tips for 29 common pitfalls (`references/gotchas.md`).

![The six production stages and their gates](docs/assets/workflow.png)

## Installation

Claude Code reads `~/.claude/skills/<skill name>/SKILL.md` as a skill.

```bash
git clone https://github.com/unclejobs-ai/motion-video-skill.git
mkdir -p ~/.claude/skills
cp -r motion-video-skill/skills/motion-video-production ~/.claude/skills/
```

To use it only in a specific project, copy the same folder into `.claude/skills/` inside that project.
After copying it, restart Claude Code and make a request like this to invoke the skill:

> I want to make a 30-second opening video featuring a character.

Claude first asks about four things (how the video will be published, duration and aspect ratio, available tools, and prohibited elements), then works through the stages in order, starting with `STORY.md`.

## Workflow

1. The skill creates the stage outputs (`STORY.md`, `character.txt`, `key/`, `clip/`, `voices.json`, `edit.json`).
2. At the end of each stage, run `python3 harness/gate.py <stage> <project-folder>`.
3. Exit code 0 means you can move to the next stage. If the exit code is 1 (BLOCK), read the BLOCK lines in `qa/gate-<stage>.txt`, fix the outputs, and run the same gate again.
4. The script cannot judge checks that require visual inspection. Passing requires review records (`qa/clips-review.md`, `qa/review.md`) written after inspecting the frame strips.

![Running gate clips: BLOCK, visual review record, PASS](docs/assets/gate-demo.gif)

This is an example of running `gate.py clips`. Without a visual review record, it returns BLOCK (exit code 1); with the record, it returns PASS (exit code 0). Write the record after opening the frame strip image (`qa/strip-<clip>.png`).

## Harness

![How the gates work: automatic measurements, visual inspection, review records](docs/assets/harness.png)

| Production stage | Gate | Checks |
|---|---|---|
| 1. Story and scene planning | `story` | Empty fields, BPM, music sync point table (whether times are numeric), scene table |
| 2. Character sheet | `character` | Whether `character.txt` is a single paragraph of plain text, color descriptions, sheet image |
| 3. Keyframes | `keyframes` | Duplicate files, aspect ratio compared with clips |
| 4. Video conversion | `clips` | Duration, frame count, starting frame match, frame strip generation, per-clip review records |
| 5. Music and voice | `audio` | A single voice ID, dialogue file |
| 6. Assembly | `edit`, `final` | Beat grid, cut transitions, repeated cuts, dialogue duration, frame count, audio, loudness, true peak, review records |

### Frame strips

Some clips start with a frame that matches the keyframe but show a changed character 1–2 seconds later. For each clip, `gate clips` creates an image with the keyframe and frames at 0, 1.0, 1.5, 2.0, and 3.0 seconds in a single row.

![Example frame strip](docs/assets/strip.png)

Image similarity scores such as SSIM cannot distinguish character movement from character deformation (`gotchas.md` G02). The gate uses numerical checks only for the starting frame match; a person must inspect and record the later frames.

### Harness check

After installation, run `bash skills/motion-video-production/harness/selftest.sh`. Exit code 0 means the gates work correctly on this computer. (Requires ffmpeg, ffprobe, and Python 3.)

## Seven criteria for character consistency

The diagram below and `skills/motion-video-production/references/consistency-7.md` show where the seven criteria for keeping faces and voices consistent across scenes fit between the six production stages: character sheet, fixed appearance description, keyframe starting frame, fixed voice, dialogue and lip movements, music beats, and quality review.

![Where the seven consistency criteria fit](docs/assets/seams.png)

## Gotchas

All 29 are documented in [`references/gotchas.md`](skills/motion-video-production/references/gotchas.md), with symptoms, causes, prevention, and harness check IDs. Common ones:

- Even when the starting frame matches, clothes, glasses, or hair can change 1–2 seconds into a clip. (G01)
- Set cut durations as multiples of beats rather than seconds, and round each starting frame only once from the cumulative time. (G11, G12)
- Measure dialogue duration before setting cut duration. (G13)
- Piping a check through `tail`, as in `검사 | tail`, loses its exit code. (G21)
- For videos with an ICC profile, `ffprobe -of csv=p=0` outputs frame counts like `30,`. Use `-of default=nw=1:nk=1`. (G27)
- In ffmpeg, using `apad` and `atrim` after `adelay` removes the delay. `asetpts=N/SR/TB` is needed. (G26)

## Required tools

Free usage limits and commercial use terms are summarized in `NOTICE.md` and detailed in `skills/motion-video-production/references/licensing.md` (checked on 2026-10-02, with source URLs). Prices and terms change frequently, so check them again immediately before starting work.

| Tool | Purpose |
|---|---|
| Claude Code | Production workflow and assembly |
| ffmpeg, Python 3 | Running the harness and scripts |
| Node.js + Remotion | Motion graphics and assembly |
| ChatGPT / Grok Imagine | Image and video generation |
| Suno | Music |
| ElevenLabs, Fish Audio | Voice |
| whisper | Transcription review (the transcription integration in `verify.sh` is unverified) |

## Repository structure

```
README.md                   Korean README
README.en.md                English README
LICENSE                     MIT
NOTICE.md                   Summary of external tool guidance
docs/assets/                README images
skills/motion-video-production/        Skill folder to install (everything below is copied together)
  SKILL.md                  Skill instructions
  references/               Seven consistency criteria, beat grid, cost rules, tool notes, gotchas, licensing (external tool terms of use)
  harness/                  gate.py (per-stage pass/fail checks), selftest.sh (harness self-check)
  scripts/                  dupcheck.py, clipsheet.sh, key-plate.sh, mix-mux.sh, verify.sh, beat-grid.py
  templates/                STORY.md, CHARACTER_SHEET.md, PROMPTS.md, SCENE_AUDIT.md
```

Remotion composition code is not included in this repository. Install Remotion separately to use it.

## Rights and responsibilities

Rights and responsibilities for generated outputs are described in `NOTICE.md` and `skills/motion-video-production/references/licensing.md`.
