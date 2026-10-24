# Runtime installation and invocation

[한국어 README](../README.md) | [English README](../README.en.md)

The source of truth is `skills/motion-video-production/`. Its `SKILL.md`, references, templates, harness, scripts, and engines are shared by all runtimes. The engines (`engines/remotion/`, `engines/hyperframes/`) live inside the skill folder so that installers that copy only the skill still ship them; they contain this repository's code plus pinned `package.json` and `package-lock.json`, not the third-party packages themselves. The repository does not include model API adapters, service credentials, or media generation connectors.

## Install for the runtimes you use

Run the following in your video project directory, then select your installed agents:

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production
```

To choose specific agents without installing to every supported target:

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production --agent codex claude-code gemini-cli cursor github-copilot opencode amp antigravity windsurf
```

Add `--global` for personal scope. The default project scope keeps the installation local to that project. The CLI's default symlink method shares one canonical copy. Install only for agents you use; do not add another copy where the same runtime already discovers this skill.

| Runtime | `--agent` value | Discovery/invocation reference |
|---|---|---|
| Codex | `codex` | [Codex skills](https://learn.chatgpt.com/docs/build-skills); project `.agents/skills/`, personal `~/.agents/skills/`; invoke `$motion-video-production` |
| Claude Code | `claude-code` | [Claude Code skills](https://code.claude.com/docs/en/skills); `.claude/skills/`, `~/.claude/skills/`; invoke `/motion-video-production` |
| Gemini CLI | `gemini-cli` | [Gemini CLI skills](https://geminicli.com/docs/cli/skills/); `.gemini/skills/` or `.agents/skills/`, `~/.gemini/skills/` or `~/.agents/skills/`; inspect with `/skills list`, request use of the skill and approve activation when asked |
| Cursor | `cursor` | [Cursor skills](https://cursor.com/docs/context/skills); `.cursor/skills/` or `.agents/skills/`, `~/.cursor/skills/` or `~/.agents/skills/`; invoke `/motion-video-production` |
| GitHub Copilot | `github-copilot` | [Copilot customization](https://docs.github.com/en/copilot/reference/customization-cheat-sheet); confirm skills in your Copilot surface, then request use of `motion-video-production` |
| OpenCode | `opencode` | [OpenCode skills](https://opencode.ai/docs/skills/); request use of `motion-video-production` |
| Amp | `amp` | [Amp skills](https://ampcode.com/docs/customize/skills); request use of `motion-video-production` |
| Antigravity | `antigravity` | [Antigravity skills](https://antigravity.google/docs/skills); request use of `motion-video-production` |
| Windsurf | `windsurf` | [Cascade skills](https://docs.windsurf.com/windsurf/cascade/skills); invoke `@motion-video-production` |

The [Vercel skills CLI supported-agent list](https://github.com/vercel-labs/skills#supported-agents) covers additional runtimes such as Cline, Continue, Roo Code, Kilo Code, Kiro CLI, Qwen Code, and others. Select their documented `--agent` identifier to install the same package. This is installer compatibility, not a claim that each runtime has completed an end-to-end video production test. Paths and features can change; check the linked docs for your installed version. Native Windows media script execution is not tested; use a Bash environment such as WSL.

## Manual installation and paths

Use the manual Codex/Claude commands in either README when you do not want the Node.js installer. Copy the **entire** `motion-video-production` folder, not just `SKILL.md`. Other runtimes use their documented discovery path.

Never run `npm ci` inside the installed skill folder: it is one shared copy, often a symlink target. Copy an engine into the output project and install it there:

```bash
cp -R "$SKILL_ROOT/engines/remotion" "$PROJECT_ROOT/engine"    # or engines/hyperframes
(cd "$PROJECT_ROOT/engine" && npm ci)
```

Keep the installed skill directory separate from the output project. For a project installation that uses `.agents/skills/`, for example, run from your video project:

```bash
SKILL_ROOT="$PWD/.agents/skills/motion-video-production"
PROJECT_ROOT="$PWD/video-project"
mkdir -p "$PROJECT_ROOT"
# Fill STORY.md using "$SKILL_ROOT/templates/STORY.md" before running the story gate.
python3 "$SKILL_ROOT/harness/gate.py" story "$PROJECT_ROOT"
bash "$SKILL_ROOT/harness/selftest.sh"
```

For a personal Codex installation, set `SKILL_ROOT="$HOME/.agents/skills/motion-video-production"` instead. Other runtime installations can have different paths; use the actual path shown in the runtime's skill list. Read references/templates relative to `SKILL_ROOT`, and run helper scripts from the output project using their absolute paths.

## Capabilities and review boundaries

- File access and a terminal are needed for the harness. Requires Python 3, ffmpeg, ffprobe, and Bash for `.sh` scripts. The engines need Node.js 24 or newer. Reference analysis needs the pinned OpenCV and numpy from `scripts/requirements-ref.txt` in a virtual environment. Rendering needs a Chromium: Remotion uses `CHROME_PATH` or a cached Playwright headless shell, otherwise `npx remotion browser ensure` downloads one; HyperFrames uses the system Chrome, otherwise `npx hyperframes browser ensure`.
- Image/video/music/voice generation requires separately available services or tools. A web subscription does not imply API access. If tools are absent, the agent provides prompts and target filenames; the user generates and supplies the files.
- If the runtime cannot view frame strips or contact sheets, the user must inspect them and provide actual review results. Never manufacture a `REVIEWED` record from measurements alone. Scripts cannot judge character deformation in later frames.
- Use the provided `STORY.md` template's Korean field names and table headings: the current gate reads those names. Fill values in the user's language. For a non-Korean character description, include `#RRGGBB` codes alongside color names so the current color check can recognize them.
- Remotion is a company-size licensed package (organizations of four or more employees need a Company License); HyperFrames is Apache-2.0. Voice automation (`vo.mjs`) needs the user's own composio CLI connection and spends their credits. Whisper transcription integration in `verify.sh` remains unverified. Check external service pricing and license terms immediately before work, as described in `NOTICE.md` and the licensing reference.

## Verification scope

Checks on 2026-10-25 (macOS, Node.js 24.20.0, Python 3.14.8), run on a `git archive` export of the committed branch so no local `node_modules` could ride along:

- `npx skills@1.7.1 add <local export> --skill motion-video-production --agent codex claude-code -y` exited 0 into a project path containing a space. All 76 skill files arrived in `.agents/skills/motion-video-production` (the same file list as the source, 45 of them under `engines/`), with Claude Code as a symlink. Only these two `--agent` identifiers were run; runtime discovery inside the apps was not re-checked for this version.
- From the installed copy: the Remotion engine copied out and `npm ci` (258 packages) exited 0; `tsc --noEmit` exited 0; `node --test` on the carry, iris and wordcut timing tests ran 13 tests, 13 passed; the carry probe on `carry-demo` scored 1.00 (PASS); two wordcut stills rendered with the npm-installed fonts. The HyperFrames engine copied out, `npm ci` exited 0, and `hyperframes lint` reported 0 errors.
- `harness/selftest.sh` from the installed copy, run from another directory, exited 0 with no failed cases (the optional Pillow ICC case was skipped because Pillow was not installed).
- In the source worktree: full renders of the wordcut demo (9:16, 600 frames) and of the carry demo in both engines, mixed with the procedural score, passed through `verify.sh`; the HyperFrames render passed `gate.py final`; `gate.py ref` compared renders to analysed targets (exit codes and numbers are in the lane report, not in this repository).

Not checked: external generation (images, video, voice credits), listening to audio, invocation inside the seven other runtimes, Windows, and Docker rendering.

Installation checks should verify that the whole package (including `harness/`, `scripts/`, `references/`, `templates/`, and `agents/`) reaches the intended discovery location. A runtime discovery check confirms that `motion-video-production` appears in that runtime's actual skill list. A harness selftest checks synthetic media cases on the current computer.

None of those alone proves a complete production run, authenticated external generation, visual review, or audio listening. Report each separately. Do not describe installer support or a successful selftest as end-to-end validation of every runtime.
