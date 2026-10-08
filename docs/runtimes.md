# Runtime installation and invocation

[한국어 README](../README.md) | [English README](../README.en.md)

The source of truth is `skills/motion-video-production/`. Its `SKILL.md`, references, templates, harness, and scripts are shared by all runtimes. The repository does not include model API adapters, service credentials, media generation connectors, or Remotion compositions.

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

- File access and a terminal are needed for the harness. Requires Python 3, ffmpeg, ffprobe, and Bash for `.sh` scripts. Node.js and a separately installed Remotion project are needed for assembly.
- Image/video/music/voice generation requires separately available services or tools. A web subscription does not imply API access. If tools are absent, the agent provides prompts and target filenames; the user generates and supplies the files.
- If the runtime cannot view frame strips or contact sheets, the user must inspect them and provide actual review results. Never manufacture a `REVIEWED` record from measurements alone. Scripts cannot judge character deformation in later frames.
- Use the provided `STORY.md` template's Korean field names and table headings: the current gate reads those names. Fill values in the user's language. For a non-Korean character description, include `#RRGGBB` codes alongside color names so the current color check can recognize them.
- Remotion code is not bundled. Whisper transcription integration in `verify.sh` remains unverified. Check external service pricing and license terms immediately before work, as described in `NOTICE.md` and the licensing reference.

## Verification scope

Package checks on 2026-10-08 used `skills@1.7.1` with all nine `--agent` identifiers listed above. All 21 skill files reached the canonical project installation, with the expected runtime aliases. A fresh Codex 0.155.1 process discovered the enabled skill and its `agents/openai.yaml` interface; Gemini CLI 0.46.0 also listed the skill as enabled. For the other seven runtimes, only installation was checked, not invocation inside the app.

The installed story gate ran from a different working directory with a space in the output path and wrote its report. The harness selftest exited 0 with no failed cases; its optional Pillow ICC regression case was skipped because Pillow was not installed. These checks did not include external generation, Remotion assembly, listening, or a full video production run.

Installation checks should verify that the whole package (including `harness/`, `scripts/`, `references/`, `templates/`, and `agents/`) reaches the intended discovery location. A runtime discovery check confirms that `motion-video-production` appears in that runtime's actual skill list. A harness selftest checks synthetic media cases on the current computer.

None of those alone proves a complete production run, authenticated external generation, visual review, or audio listening. Report each separately. Do not describe installer support or a successful selftest as end-to-end validation of every runtime.
