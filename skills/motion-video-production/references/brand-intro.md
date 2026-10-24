# 브랜드 소개 영상을 홈페이지에 넣기

레퍼런스 몇 개를 받아 짧은 브랜드 소개 영상을 만들고, 그 영상이 재생되는 홈페이지 HTML 한 장까지 만드는 순서예요. 새 엔진은 없어요. Remotion 엔진의 wordcut 템플릿과 `templates/homepage-intro.html`을 써요. 아래 예시 가게("동네빵집 모퉁이")는 지어낸 것이에요.

산출물은 두 개예요. `media/intro.mp4`(소리 없는 짧은 영상, 마지막 장면이 마무리 이미지)와, 그 영상을 Three.js 장면 안에서 재생하는 `index.html` 한 장이에요.

## 1. 레퍼런스를 읽고 장면 목록 쓰기 (4줄 이하)

레퍼런스 영상이 있으면 0단계(`references/reference-analysis.md`)로 숫자를 먼저 뽑아요. 그다음 장면 목록을 4줄 이하로 써요. 한 줄 = 프레임 범위, 화면, 어느 레퍼런스에서 빌려 오는지.

| 프레임 | 화면 | 빌려 오는 것 |
|---|---|---|
| 0-120 | "빵"이 한 자리에 머물고 메뉴판, 영수증, 메모가 차례로 넘겨받음 | 레퍼런스 A의 휙 넘김 속도 |
| 120-240 | 몰아치기: 0.13초마다 장면이 바뀜 | 레퍼런스 A의 짧은 컷 구간 |
| 240-450 | 교과서 문장에서 글자가 흩어지고 단어가 사전 표제어가 됨 | 레퍼런스 B의 긴 홀드 |
| 450-600 | 마무리 이미지(진열대)로 넘어가 멈춤 | 레퍼런스 C의 마지막 장면 구도 |

## 2. 키워드 3~6개

이미지 프롬프트와 마무리를 정하는 단어예요. 예: `아침`, `갓 구운`, `진열대`, `이웃`. 단어 하나는 wordcut의 주인공(`data.ts`의 `word`)이 되고, 나머지는 장면 문구와 마무리 이미지 프롬프트에 들어가요.

## 3. 마무리 이미지 만들기

이미지 생성 도구로 마무리 이미지 한 장을 만들어요(`references/providers.md`). 화면비는 영상과 같게(9:16이면 1080x1920) 하고, 단어 자리(화면 높이 44% 부근)는 비워 둬요. 단어가 그 위에 남기 때문이에요. 사람이 만든 사진처럼 보이게 꾸미지 않고, 생성 이미지라는 표시가 필요하면 페이지에 적어요.

## 4. wordcut으로 컷 만들기

1. 엔진을 복사해 설치해요(`references/engines.md`).
2. `productions/wordcut/data.ts`에 단어, 장면 문구, 끝 문구를 키워드로 채워요.
3. 마무리 이미지를 엔진 폴더의 `public/closing.jpg`로 두고 `data.ts`의 `closing`을 `'closing.jpg'`로 바꿔요. 마지막 2초에 이미지로 넘어가 멈추고, 단어는 같은 자리에 남아요.
4. 레퍼런스 분석이 있으면 `node productions/wordcut/plan.mjs ref/analysis.json <초>`로 타이밍을 뽑아요.
5. `node productions/wordcut/render.mjs video 9x16`로 렌더하고, `drift.mjs`와 `verify.sh`로 재요. 레퍼런스가 있으면 `gate.py ref`로 비교해요.

## 5. 홈페이지 한 장

`templates/homepage-intro.html`을 복사해 `index.html`로 두고, 옆에 `media/` 폴더를 만들어요.

```bash
mkdir -p site/media
cp "$SKILL_ROOT/templates/homepage-intro.html" site/index.html
cp renders/wordcut/wordcut-9x16.mp4 site/media/intro.mp4
ffmpeg -sseof -0.1 -i site/media/intro.mp4 -frames:v 1 -q:v 3 site/media/poster.jpg   # 마지막 프레임 = 포스터
```

- 히어로의 왼쪽(휴대폰에서는 위)에서 영상이 Three.js 장면 안의 카드에 텍스처로 재생돼요. 카드는 포인터를 살짝 따라 기울고 천천히 숨 쉬듯 움직여요. 움직임은 이것 하나뿐이에요.
- 영상은 `muted loop playsinline`이라 자동 재생돼요. 자동 재생이 막히면 포스터를 그대로 보여 줘요.
- `prefers-reduced-motion`이 켜져 있거나 WebGL이 없으면 Three.js를 불러오지 않고, 포스터 이미지와 일반 페이지만 보여 줘요.
- Three.js는 `three@0.170.0`(MIT)을 jsDelivr에서 고정 버전으로 불러와요. 오프라인으로 배포하려면 같은 버전 파일을 옆에 두고 import map 주소만 바꿔요.
- 문구, 색(`:root` 변수), 버튼 링크를 가게 것으로 바꿔요. 주 버튼은 읽는 흐름의 끝(오른쪽)에 둬요.

## 확인한 것 (2026-10-25)

wordcut 데모 렌더를 `media/intro.mp4`로 넣고 로컬 서버에서 열었어요. Google Chrome(헤드리스)에서 영상이 WebGL 카드 위에서 재생됐어요(`paused=false`). reduced motion과 WebGL 끔 상태에서는 Three.js를 부르지 않고 포스터만 보였어요. 포스터는 카드와 같은 자리, 같은 크기, 같은 흰 테두리로 놓여서 두 상태를 오가도 그림이 움직이지 않아요. 폭 390px과 1280px에서 확인했어요.

확인할 때 주의할 점이 두 가지 있어요. Playwright의 Chromium 헤드리스 셸은 H.264를 재생하지 못해서 포스터에 머물러요(VP9 사본으로는 재생돼요). 헤드리스 Google Chrome은 창 폭을 500px 아래로 줄이지 못해서, 390px 스크린샷이 500px 레이아웃을 잘라 낸 것이 돼요. 휴대폰 폭은 헤드리스 셸이나 실제 기기로 확인해요.
