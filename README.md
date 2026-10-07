<p>
  <img src="docs/assets/logo.svg" width="80" height="80" alt="Motion Video Production 로고" />
</p>

# motion-video-production

**한국어** · [English](README.en.md)

모션 그래픽과 영상(30~90초)을 처음부터 끝까지 만드는 순서와 점검 기준을 담은 **Agent Skills 형식의 제작 스킬**입니다. Codex, Claude Code 및 다른 스킬 지원 런타임에서 같은 스킬 폴더를 사용합니다.
제작 6단계마다 산출물을 측정해 통과 여부를 종료 코드로 판정하는 검사 스크립트(`harness/gate.py`, 이하 게이트)와, 자주 생기는 함정 29가지의 예방법(`references/gotchas.md`)이 들어 있습니다.

**바로 가기** · [설치](#설치) · [사용 흐름](#사용-흐름) · [실행 예시](#게이트-실행-예시) · [하네스](#하네스) · [필요한 도구](#필요한-도구)

---

## 설치

### 공통 설치 (Codex·Claude Code·다른 런타임)

스킬을 사용할 프로젝트 폴더에서 실행합니다. Node.js와 npx가 필요하며, 사용할 런타임을 선택해 설치합니다.

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production
```

Codex만 지정하려면 아래처럼 실행합니다. 개인 범위로 설치하려면 `--global`을 추가합니다.

```bash
npx skills add unclejobs-ai/motion-video-skill --skill motion-video-production --agent codex
```

[Vercel skills CLI](https://github.com/vercel-labs/skills)가 Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode, Amp, Antigravity, Windsurf 등 지원 대상의 설치 위치를 처리합니다. **설치 호환성과 전체 영상 제작 검증은 다릅니다.** 생성 도구 연결과 이미지 보기·명령 실행 권한은 각 런타임 환경에 달려 있습니다. [런타임별 설치·호출과 검증 범위](docs/runtimes.md)를 참고합니다.

<details>
<summary><strong>수동 설치 (Node.js 없이)</strong></summary>

Codex는 프로젝트 `.agents/skills/`와 개인 `~/.agents/skills/`에서 스킬을 읽습니다. 아래는 개인 설치 예시입니다.

```bash
git clone https://github.com/unclejobs-ai/motion-video-skill.git
mkdir -p ~/.agents/skills
cp -r motion-video-skill/skills/motion-video-production ~/.agents/skills/
```

Claude Code는 프로젝트 `.claude/skills/`와 개인 `~/.claude/skills/`에서 스킬을 읽습니다. 기존 설치 명령도 계속 사용할 수 있습니다.

```bash
git clone https://github.com/unclejobs-ai/motion-video-skill.git
mkdir -p ~/.claude/skills
cp -r motion-video-skill/skills/motion-video-production ~/.claude/skills/
```

특정 프로젝트에서만 쓰려면 해당 프로젝트의 런타임별 스킬 폴더 아래에 같은 폴더를 복사합니다. 한 런타임에 같은 이름을 여러 경로로 중복 설치하지 않습니다.

</details>

### 첫 요청

설치한 뒤 런타임의 스킬 목록에서 `motion-video-production`을 확인합니다. 보이지 않으면 런타임을 새로 시작합니다. Codex에서는 `$motion-video-production`, Claude Code와 Cursor에서는 `/motion-video-production`으로 명시적으로 호출하거나 아래처럼 요청합니다.

> 캐릭터가 나오는 30초짜리 오프닝 영상을 만들고 싶어.

에이전트가 먼저 4가지(공개 방식, 길이와 화면비, 쓸 수 있는 도구, 금지 요소)를 묻고, `STORY.md`부터 단계 순서대로 진행합니다. 생성 도구가 없으면 프롬프트를 전달하고 사용자가 생성한 파일을 받아 이어갑니다. 이미지를 볼 수 없으면 사용자의 실제 눈 검수를 요청합니다.

## 사용 흐름

![제작 6단계와 단계별 게이트](docs/assets/workflow.png)

1. 스킬이 단계 산출물을 만듭니다 (`STORY.md`, `character.txt`, `key/`, `clip/`, `voices.json`, `edit.json`).
2. 설치된 `SKILL.md`의 부모 폴더를 `SKILL_ROOT`, 산출물 폴더를 `PROJECT_ROOT`로 정하고, 단계가 끝나면 `python3 "$SKILL_ROOT/harness/gate.py" <단계> "$PROJECT_ROOT"`를 실행합니다.
3. 종료 코드 0이면 다음 단계로 넘어갑니다. 1(BLOCK)이면 `qa/gate-<단계>.txt`의 BLOCK 줄을 읽고 산출물을 고쳐 같은 게이트를 다시 실행합니다.
4. 눈으로 봐야 하는 검사는 스크립트가 판정할 수 없습니다. 프레임 스트립을 보고 남긴 기록 파일(`qa/clips-review.md`, `qa/review.md`)이 있어야 통과합니다.

### 게이트 실행 예시

`gate.py clips` 실행 예시입니다. 눈 검수 기록이 없어서 BLOCK(종료 코드 1)이 나오고, 기록을 남기면 PASS(종료 코드 0)가 됩니다. 기록은 프레임 스트립 이미지(`qa/strip-<클립>.png`)를 연 뒤에 씁니다.

![gate clips 실행: BLOCK, 눈 검수 기록, PASS](docs/assets/gate-demo.gif)

## 하네스

![게이트 동작: 자동 측정, 눈으로 확인, 기록 파일](docs/assets/harness.png)

| 제작 단계 | 게이트 | 하는 검사 |
|---|---|---|
| 1. 스토리·장면 기획 | `story` | 빈칸, BPM, 음악 싱크 지점 표(시간이 숫자인지), 장면 표 |
| 2. 캐릭터 시트 | `character` | `character.txt`가 1개 문단 평문인지, 색 표현, 시트 이미지 |
| 3. 키프레임 | `keyframes` | 중복 파일, 클립과의 화면비 |
| 4. 영상 변환 | `clips` | 길이, 프레임 수, 시작 화면 일치, 프레임 스트립 생성, 클립별 판정 기록 |
| 5. 음악·목소리 | `audio` | 음성 ID 1개, 대사 파일 |
| 6. 조립 | `edit`, `final` | 박 격자, 컷 연결, 반복 컷, 대사 길이, 프레임 수, 오디오, 라우드니스, true peak, 검수 기록 |

### 프레임 스트립

시작 화면이 키프레임과 같아도 1~2초 뒤에 인물이 달라지는 클립이 있습니다. `gate clips`가 클립마다 키프레임, 0, 1.0, 1.5, 2.0, 3.0초를 한 줄에 놓은 이미지를 만듭니다.

![프레임 스트립 예시](docs/assets/strip.png)

SSIM 같은 화면 유사도 값은 인물의 움직임과 인물의 변형을 구분하지 못합니다(`gotchas.md` G02). 게이트는 시작 화면 일치만 숫자로 판정하고, 뒤쪽 프레임은 사람이 보고 기록하게 합니다.

### 하네스 점검

저장소 폴더에서 `bash skills/motion-video-production/harness/selftest.sh`를 실행합니다. 설치된 사본을 점검하려면 `bash "$SKILL_ROOT/harness/selftest.sh"`를 실행합니다. 종료 코드 0이면 이 컴퓨터에서 셀프테스트의 검사 사례가 기대대로 동작합니다. (Bash, ffmpeg, ffprobe, Python 3 필요)

## 캐릭터 일관성 7가지

장면이 바뀌어도 얼굴과 목소리를 같게 유지하는 7가지 기준(캐릭터 시트, 외형 고정문, 키프레임 시작 화면, 목소리 고정, 대사와 입 모양, 음악 박자, 품질 검수)이 제작 6단계의 어느 이음새에 놓이는지는 아래 그림과 `skills/motion-video-production/references/consistency-7.md`에 있습니다.

![일관성 7가지가 놓이는 자리](docs/assets/seams.png)

## Gotchas

전체 29가지는 [`references/gotchas.md`](skills/motion-video-production/references/gotchas.md)에 증상, 원인, 예방, 하네스 검사 ID로 정리되어 있습니다. 자주 부딪히는 것:

- 클립은 시작 화면이 같아도 1~2초 뒤에 옷, 안경, 머리가 바뀝니다. (G01)
- 컷 길이는 초가 아니라 박의 배수로 정하고, 시작 프레임은 누적 시간에서 한 번만 반올림합니다. (G11, G12)
- 대사 길이를 먼저 재고 컷 길이를 정합니다. (G13)
- `검사 | tail`처럼 파이프로 자르면 종료 코드가 사라집니다. (G21)
- ICC 프로파일이 붙은 영상에서 `ffprobe -of csv=p=0`은 프레임 수를 `30,`처럼 출력합니다. `-of default=nw=1:nk=1`을 씁니다. (G27)
- ffmpeg에서 `adelay` 뒤에 `apad`, `atrim`을 쓰면 지연이 사라집니다. `asetpts=N/SR/TB`가 필요합니다. (G26)

## 필요한 도구

무료 범위와 상업 이용 조건은 `NOTICE.md` 요약과 `skills/motion-video-production/references/licensing.md`(2026-10-02 확인, 출처 URL 포함)에 있습니다. 요금과 약관은 자주 바뀌므로 작업 직전에 다시 확인합니다.

| 도구 | 용도 |
|---|---|
| Codex, Claude Code 등 스킬 지원 에이전트 | 제작 진행·조립 |
| ffmpeg, ffprobe, Python 3 | 하네스·스크립트 실행 |
| Bash (macOS/Linux, Windows는 WSL) | `.sh` 스크립트 실행 |
| Node.js + Remotion | 모션 그래픽·조립 |
| ChatGPT / Grok Imagine | 이미지·영상 생성 |
| Suno | 음악 |
| ElevenLabs, Fish Audio | 목소리 |
| whisper | 받아쓰기 검수 (`verify.sh`의 받아쓰기 연동은 미검증) |

## 저장소 구조

```
README.md
README.en.md                영문 README
LICENSE                     MIT
NOTICE.md                   외부 도구 안내 요약
docs/assets/                README 이미지
docs/runtimes.md            런타임별 설치·호출과 검증 범위
skills/motion-video-production/        설치하는 스킬 폴더 (아래 전체가 함께 복사됩니다)
  SKILL.md                  스킬 본문
  agents/openai.yaml        Codex 표시 이름·호출 예시
  references/               일관성 7가지, 박 격자, 비용 규칙, 도구 메모, gotchas, licensing(외부 도구 이용 조건)
  harness/                  gate.py(단계별 통과 여부 판정), selftest.sh(하네스 자체 검증)
  scripts/                  dupcheck.py, clipsheet.sh, key-plate.sh, mix-mux.sh, verify.sh, beat-grid.py
  templates/                STORY.md, CHARACTER_SHEET.md, PROMPTS.md, SCENE_AUDIT.md
```

Remotion 컴포지션 코드는 이 저장소에 포함되어 있지 않습니다. Remotion을 직접 설치해 사용합니다.

## 책임 범위

생성물의 권리와 책임은 `NOTICE.md`와 `skills/motion-video-production/references/licensing.md`에 있습니다.
