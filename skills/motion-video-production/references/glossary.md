# 편집·모션 용어집

이 스킬의 문서와 템플릿에 나오는 편집·카메라·질감 용어를 한국어로 먼저, 영어를 괄호에 적었어요. 한 줄에 뜻과, 이 스킬에서 어디에 나오는지(템플릿, 게이트, 스크립트)를 같이 적어요. 이 스킬이 쓰는 쉬운 말(휙 넘김, 몰아치기, 박, 홀드)도 같이 적어서 어느 쪽으로 찾아도 걸리게 했어요.

## 컷과 전환

- 매치 컷(graphic match cut): 장면은 바뀌는데 단어 하나가 화면의 같은 자리에 남아 이어지는 편집이에요. wordcut 템플릿 전체가 이 형식이고(`productions/wordcut/`), `drift.mjs`가 단어가 0.5px 넘게 움직이면 종료 코드 1을 내요.
- 휩 팬(whip pan): 컷 사이에 화면이 빠르게 휙 쓸리는 전환이에요. 이 스킬의 "휙 넘김"이고, wordcut `timing.ts`의 `whip`(나가는 블러 `outBlur`, 들어오는 블러 `inBlur`)이 정하고, 레퍼런스에서는 `motion.transitions`로 재요.
- 하드 컷(hard cut): 전환 효과 없이 바로 다음 장면으로 넘어가는 컷이에요. carry 검사에서는 bare로 세지만, wordcut 몰아치기(`burst`)처럼 몰아치기 안의 하드 컷은 점수에서 빠져요(`references/pitfalls.md`).
- 점프 컷(jump cut): 같은 장면 안에서 시간이 툭 건너뛰어 화면이 튀어 보이는 컷이에요. 이 스킬은 일부러 쓰지 않고, 의도하지 않은 건너뜀은 `templates/SCENE_AUDIT.md`의 "시간·장소 점프" 항목으로 잡아요.
- 몽타주(montage): 짧은 컷을 빠르게 이어 붙여 하나의 인상을 만드는 편집이에요. 이 스킬의 "몰아치기"(1.5초 안에 큰 변화 3번 이상, `references/art-direction.md`)이고, wordcut에서는 `plan.ts`의 `burstStep`, `burstCount`가 정해요.
- 디졸브·크로스 페이드(dissolve / cross-fade): 앞 장면이 서서히 사라지며 다음 장면과 겹쳐 바뀌는 전환이에요. wordcut에서는 마무리 이미지가 마지막 2초에 15프레임 동안 서서히 덮이는 곳(`timing.ts`의 `closing`)에만 쓰고, carry 검사에서는 bare로 세요.
- 와이프·아이리스(wipe / iris): 다음 장면이 선이나 원 모양으로 앞 장면을 밀어내며 드러나는 전환이에요. 커튼, 차오름, 밀기, 스미어가 같은 갈래이고, `references/art-direction.md`의 bare 경계 표와 `motions/iris`에 있어요.
- 동작에서 컷(cut on action): 움직임이 부딪히는 프레임에서 정확히 자르는 컷이에요. bare라서 몰아치기 안에서만 써요(`references/art-direction.md`).
- J컷·L컷(J-cut / L-cut): 다음 장면의 소리가 화면보다 먼저 들어오거나(J), 화면이 바뀐 뒤에도 앞 장면 소리가 남는(L) 편집이에요. 이 스킬에는 전용 템플릿이나 검사가 없어요. 대사는 길이를 먼저 재고 컷을 맞춰요(G13, `pipeline/vo-assemble.mjs`).
- carry(이 스킬의 용어): 비트 경계를 넘어 화면에 살아남아 움직이거나 커지는 요소예요. `pipeline/probe.mjs`가 렌더 전에 재고(0.5 미만 FAIL), `verify.sh`에 `PRODUCTION`을 주면 같이 재요.
- carried·anchored·bare(이 스킬의 용어): carry 검사가 경계를 세는 세 가지예요. 살아남아 움직이면 carried, 그대로 있으면 anchored(절반 점수), 아무것도 안 남으면 bare예요(`pipeline/carry.ts`).
- 엔드카드(end card): 영상 끝에 로고, 문구, 행동 버튼을 보여 주는 마지막 화면이에요. bare 경계를 써도 되는 두 곳 중 하나예요.

## 카메라

- 미드숏(medium shot): 피사체와 주변이 함께 보이는 중간 거리의 화면이에요. wordcut의 0프레임이 페이지 전체가 아니라 미드숏이고, `frame0.mjs --check`가 확인해요.
- 클로즈업(close-up): 피사체 하나가 화면을 채우는 가까운 화면이에요. wordcut의 컷은 클로즈업 배율(`scene.ts`의 `close`)에서 시작해요.
- 푸시 인·돌리(push-in / dolly): 카메라가 피사체 쪽으로 다가가 화면이 서서히 커지는 움직임이에요. 이 스킬의 "밀기", "밀고 들어가기"이고, wordcut `timing.ts`의 `opener.push`, `textbook.push`, `dict.push`가 정해요.
- 랙 포커스(rack focus): 초점을 한 거리에서 다른 거리로 옮기는 것이에요. wordcut 첫 장면의 초점 띠가 `opener.rack` 프레임(9프레임)에 걸쳐 풀리는 것이 이것이에요.
- 얕은 심도(shallow depth of field): 초점이 맞는 깊이가 좁아서 한 줄만 선명하고 나머지는 흐린 화면이에요. 이 스킬의 "초점 띠"이고, `look.ts`의 `dof`가 정하고, `frame0.mjs`가 초점 비율(2 미만이면 실패)로, 레퍼런스에서는 `dof.bands`로 재요.
- 패럴랙스(parallax): 가까운 것은 빠르게, 먼 것은 느리게 움직여 깊이가 느껴지게 하는 것이에요. `references/art-direction.md`의 "크기·속도·블러가 다른 3겹"이에요.
- 더치 앵글(dutch angle): 화면을 몇 도 기울여 긴장을 주는 구도예요. 애니메이션 PV 스타일에서 −2~−4°로 써요(`references/art-direction.md`).

## 렌즈 질감

- 모션 블러(motion blur): 빠르게 움직이는 것이 움직임 방향으로 번져 보이는 것이에요. wordcut은 휩 팬 동안 방향성 블러를 넣고(`scene.ts`), 레퍼런스에서는 `blur.alongPx`, `blur.anisotropy`로 재요.
- 색수차·RGB 분리(chromatic aberration / RGB split): 빨강·초록·파랑이 살짝 어긋나 가장자리에 색 테두리가 생기는 렌즈 질감이에요. wordcut `timing.ts`의 `opener.split`, `splitRest`가 정해요.
- 그레인(film grain): 필름 같은 미세한 입자감이에요. `look.ts`의 `grain`이 정하고, 레퍼런스에서는 `look.grain`으로 재요. 그레인을 넣으면 md5로 반복 프레임을 못 찾아요(`references/gotchas.md`).
- 비네트(vignette): 화면 가장자리가 가운데보다 어두워지는 것이에요. `look.ts`의 `vignette`가 정해요.

## 리듬

- 비트·박 격자(beat / beat grid): 음악의 박을 시간 눈금으로 삼아 컷을 거기에 맞추는 것이에요. `references/beat-grid.md`, `scripts/beat-grid.py`, `templates/BEATSHEET.md`, wordcut `timing.ts`의 `MUSIC.hits`에 있어요.
- 홀드(hold): 움직임을 멈추고 한 화면에 머무는 구간이에요. 움직임이 착지하는 자리이고, 레퍼런스에서는 `edit.holds`로, wordcut에서는 `plan.ts`의 `hold`가 컷 간격을 정해요.
- 오버슈트(overshoot): 목표를 조금 지나쳤다가 돌아와 자리 잡는 움직임이에요. 깔끔한 제품 스타일에서는 도착에만 써요(`references/art-direction.md`).
- 임팩트 프레임(impact frame): 큰 타격 순간에 1~2프레임 화면을 반전시키는 강조예요. 애니메이션 PV 스타일에 있어요(`references/art-direction.md`).
- 덕킹(ducking): 대사가 나오는 동안 음악 볼륨을 자동으로 낮추는 믹스예요. `scripts/mix-mux.sh`가 해요.

## 화면과 출력

- 첫 프레임·썸네일 프레임(first frame / thumbnail frame): 재생 전이나 피드에서 처음 보이는 한 장이에요. wordcut은 0프레임을 `frame0.mjs --check`로 판정하고, 홈페이지 템플릿은 마지막 프레임을 포스터로 써요(`references/brand-intro.md`).
- 세이프 영역(safe area): 화면 가장자리에서 잘리거나 플랫폼 UI에 가려질 수 있어 글자를 두지 않는 안쪽 경계예요. 이 스킬에는 전용 검사가 없어요. 가장자리 색은 `verify.sh`가 재요.
- 키프레임(keyframe): 이 스킬에서는 영상 생성의 시작 화면으로 쓰는 이미지 한 장이에요(3단계). 애니메이션 도구의 "값을 찍는 시점"과 다른 뜻이에요.
- 컨택트 시트(contact sheet): 영상의 여러 시점을 한 장에 격자로 늘어놓은 이미지예요. `scripts/verify.sh`와 `scripts/clipsheet.sh`가 만들어요.
- 크로마키(chroma key): 단색(초록) 배경을 지워 캐릭터만 떼어 내는 합성이에요. 이 스킬은 RGB 기준 `colorkey`를 쓰는 `scripts/key-plate.sh`로 해요.
- 키네틱 타이포그래피(kinetic typography): 글자 자체가 움직이며 내용을 전하는 모션 그래픽이에요. wordcut 끝의 교과서 글자가 흩어지고 단어가 사전 표제어가 되는 구간, `productions/carry-demo`의 단어가 라벨이 되는 경계가 이것이에요.
- 스크롤 연동 영상(scroll-scrubbed video): 스크롤 위치에 따라 영상의 재생 위치가 앞뒤로 움직이는 웹 기법이에요. 이 스킬의 홈페이지 템플릿은 쓰지 않고 자동 재생 반복을 써요. 쓰려면 `references/brand-intro.md`의 외부 라이브러리 규칙을 따라요.
