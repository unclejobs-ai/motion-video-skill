# 엔진: Remotion과 HyperFrames

화면을 만드는 엔진은 바꿔 끼울 수 있습니다. 엔진이 무엇이든 마지막 산출물은 mp4 하나이고, 믹스(`scripts/mix-mux.sh`), 측정(`scripts/verify.sh`), 레퍼런스 비교(`gate.py ref`), 최종 게이트(`gate.py final`)는 그 mp4만 봅니다.

![엔진을 바꿔 끼우는 분석 파이프라인](../../../docs/assets/ref-pipeline.png)

## 어느 쪽을 고를까

| | Remotion (`engines/remotion/`) | HyperFrames (`engines/hyperframes/`) |
|---|---|---|
| 만드는 방식 | React 컴포넌트. 모든 값을 프레임 번호에서 계산 | 평범한 HTML/CSS 페이지에 GSAP 타임라인 |
| 잘 맞는 경우 | 프레임 단위로 정확해야 할 때, 요소가 경계를 넘어 살아남는지(carry) 숫자로 증명하고 싶을 때, wordcut처럼 한 자리 고정이 핵심일 때 | 재료가 웹페이지·문서일 때, HTML/CSS를 아는 사람이 바로 고쳐야 할 때, 빠른 시안 |
| carry 검사 | 있음. `track.ts`로 선언한 상자를 `pipeline/probe.mjs`가 렌더 전에 잽니다 | 선언한 track이 없어서 carry 점수는 못 냅니다. 움직임·편집 리듬은 `gate.py ref`가 mp4에서 잽니다 |
| 들어 있는 것 | carry 데모, wordcut 템플릿, 모션 모듈, 렌더·목소리·스코어 스크립트 | 같은 carry 데모 한 페이지 |
| 라이선스 | 회사 규모에 따른 자체 라이선스(직원 4명 이상 영리 조직은 Company License) | Apache-2.0 (애니메이션은 GSAP 표준 무료 라이선스) |
| 렌더 브라우저 | Playwright 헤드리스 셸이나 `CHROME_PATH`. 없으면 `npx remotion browser ensure`(다운로드, 먼저 물어봄) | 시스템 Chrome. 없으면 `npx hyperframes browser ensure`(다운로드, 먼저 물어봄) |

정하기 어려우면 Remotion으로 시작합니다. carry와 wordcut이 Remotion에만 있기 때문입니다. 라이선스 조건(`references/licensing.md`)이 맞지 않으면 HyperFrames를 씁니다.

## 준비

엔진은 스킬 폴더 안에 들어 있습니다. 스킬 폴더는 여러 런타임이 함께 쓰므로 그 안에서 설치하지 않습니다. 작업 폴더로 복사한 뒤 설치합니다.

```bash
cp -R "$SKILL_ROOT/engines/remotion" "$PROJECT_ROOT/engine"      # 또는 engines/hyperframes
cd "$PROJECT_ROOT/engine" && npm ci                                  # 버전은 package-lock.json에 고정
```

Node.js 24 이상이 필요합니다(`.ts` 파일을 바로 실행). 모든 의존성은 정확한 버전으로 고정돼 있습니다.

## Remotion 엔진에서 하는 일 (엔진 폴더에서 실행)

| 일 | 명령 |
|---|---|
| 타입 확인, 테스트 | `npm run typecheck`, `node --test pipeline/carry.test.ts motions/iris/iris.test.ts productions/wordcut/timing.test.ts` |
| carry 검사 (렌더 전) | `node pipeline/probe.mjs productions/<id>` (종료 코드 1 = FAIL) |
| 스틸과 컨택트 시트 | `node pipeline/render.mjs <id> --stills 0.5 1.5 3.0` |
| 영상 렌더 (소리 없음) | `node pipeline/render.mjs <id>` → `renders/<id>/picture.mp4` |
| 기본 스코어 | `node pipeline/score.mjs productions/<id>` → `productions/<id>/audio/score.wav` |
| 목소리 | `node pipeline/vo.mjs productions/<id>/vo`, `node pipeline/vo-assemble.mjs productions/<id>/vo <초> productions/<id>/vo/cues.json` |
| 믹스와 mux | `bash "$SKILL_ROOT/scripts/mix-mux.sh" <picture.mp4> <fps> <초> <score.wav> <vo_track.wav 또는 -> "$PROJECT_ROOT/out/final.mp4"` |
| 측정 | `PRODUCTION=productions/<id> bash "$SKILL_ROOT/scripts/verify.sh" "$PROJECT_ROOT/out/final.mp4"` |

새 작품은 `productions/carry-demo/`를 복사해 시작합니다. 파일 구성: `timing.ts`(계약), `scene.ts`(시각 t의 순수 기하), `<이름>.tsx`(얇은 Remotion 호스트), `track.ts`(carry 검사가 읽는 상자), `BEATSHEET.md`(`templates/BEATSHEET.md`), `vo/`, `audio/`. 컴포지션은 `src/Root.tsx`에 등록합니다.

## wordcut 템플릿 (`productions/wordcut/`)

단어 하나가 화면의 한 자리에 머물고, 그 단어를 담은 여러 장면(게시글, 영수증, 기사, 채팅, 메모, 검색창, 알림…)이 카메라 휙 넘김(휩 팬, whip pan)으로 차례로 단어를 넘겨받는 매치 컷(graphic match cut) 형식입니다. 용어는 `references/glossary.md`에 있습니다. 끝은 교과서 문장의 글자가 흩어지고 단어가 사전 표제어가 됩니다.

- **바꾸는 곳**: `data.ts`(단어, 장면 목록과 문구, 끝 문구, 화면비). 모든 문구는 단어 자리를 `{w}`로 표시하고, 장면마다 정확히 한 번 씁니다(`timing.test.ts`가 확인).
- **타이밍**: `plan.ts`. 레퍼런스가 있으면 `node productions/wordcut/plan.mjs "$PROJECT_ROOT/ref/analysis.json" <초>`가 컷 간격·몰아치기·블러를 레퍼런스에서 뽑아 씁니다.
- **고정된 구조**: 단어는 한 자리(측정 드리프트 0.11px 이하), 장면이 단어를 넘겨받음, 휙 넘김(나가는 장면의 마지막 프레임과 들어오는 장면의 첫 프레임이 모션 블러와 함께 이동), 몰아치기 구간(하드 컷 몽타주), 교과서, 사전.
- **마무리 이미지**: `data.ts`의 `closing`에 엔진 `public/` 폴더의 이미지 파일 이름을 넣으면 마지막 2초에 그 이미지로 넘어가 멈추고 단어는 자리에 남습니다(`references/brand-intro.md`).
- **렌더**: `node productions/wordcut/render.mjs video [9x16|16x9]` → `renders/wordcut/wordcut-<화면비>.mp4`
- **한 자리 확인**: `node productions/wordcut/drift.mjs [9x16|16x9]` (픽셀 측정, 0.5px 넘게 움직이면 종료 코드 1)
- **첫 프레임은 페이지가 아니라 미드숏(medium shot)입니다**: 단어가 화면 가운데에 있고, 단어 줄만 선명한 초점 띠(얕은 심도)가 있고, 렌즈 질감(RGB 분리 = 색수차, 그레인, 비네트)이 0프레임부터 켜져 있고, 페이지 크롬(메타 줄, 카드 테두리)이 보이지 않고, 하이라이트가 유일한 색입니다. 첫 장면은 페이지보다 더 밀어 들어가(푸시 인) 단어 줄이 양쪽 끝을 넘고, 초점 띠와 RGB 분리는 `timing.ts`의 `opener`대로 9프레임에 걸쳐 풀립니다(랙 포커스). 해시태그 같은 다른 색 글자는 회색으로 둡니다.
- **첫 프레임 확인**: `node productions/wordcut/frame0.mjs --check` (렌더한 영상의 0프레임에서 단어 중심이 가로 5%, 세로 12%를 넘게 벗어나거나 초점 비율이 2 미만이면 종료 코드 1)
- **장면마다 초점 확인**: `node productions/wordcut/focus.mjs --check [--sheet 착지.png]` (모든 컷의 착지 프레임에서 같은 초점 비율을 재고, 하나라도 2 미만이면 종료 코드 1. `--sheet`는 착지 프레임 대조표를 만듭니다)
- **장면마다 다르게**: `timing.ts`의 `SHOT_PRESETS`가 컷마다 기울기(`rx` 책상 위 종이 +, 들어 올린 휴대폰 −, `rz` 회전), 확대(`push`), 심도(`dof`), 흐린 줄의 RGB 분리(`split`), 바닥(`ground`), 빛과 그레인을 정합니다. 이웃한 두 컷은 같은 조합을 쓰지 않습니다(`timing.test.ts`가 확인). 시트, 하이라이트, 단어는 한 래퍼 안에서 같이 기울어서 단어가 자기 문서에서 벗어나지 않습니다. 원근으로 기울인 상자는 면적 중심이 가까운 쪽으로 쏠리므로 `drift.mjs`는 단어 중심점(1px 점)으로 판정합니다.
- **질감 맞추기**: `node productions/wordcut/look-fit.mjs "$PROJECT_ROOT/ref/analysis.json"` → 결과를 `look.ts`에 붙여 넣습니다. 렌더 한 번에 스틸 30장을 여러 번 렌더하므로 오래 걸립니다.
- 글꼴: Pretendard, 나눔명조, JetBrains Mono. 모두 SIL OFL 1.1 npm 패키지이고 버전이 고정돼 있습니다.

## HyperFrames 엔진에서 하는 일

| 일 | 명령 |
|---|---|
| 검사 | `npx hyperframes lint`, `npx hyperframes validate` |
| 미리보기 | `npx hyperframes preview` (계속 도는 서버) |
| 렌더 | `npx hyperframes render --fps 30 --quality high -o renders/<이름>.mp4` |

`index.html`의 루트 요소에 `data-composition-id`, `data-width`, `data-height`, `data-duration`을 두고, `gsap.timeline({ paused: true })`를 `window.__timelines["<컴포지션 ID>"]`에 등록합니다. 자세한 규칙은 `npx hyperframes docs compositions`, `npx hyperframes docs gsap`에 있습니다. 렌더한 mp4는 Remotion과 같은 `mix-mux.sh`, `verify.sh`, `gate.py ref`, `gate.py final`로 넘깁니다.
