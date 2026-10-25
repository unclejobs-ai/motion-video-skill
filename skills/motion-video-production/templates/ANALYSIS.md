# 레퍼런스 분석

`ref/analysis.json`의 숫자를 옮겨 적고, 그 숫자가 이번 작품의 계획을 어떻게 정하는지 적습니다.
꺾쇠로 감싼 빈칸이 하나라도 남아 있으면 `gate.py ref`가 막습니다. 지표의 뜻은 `references/reference-analysis.md`에 있습니다.

- 레퍼런스: <길이(초), 화면비, fps>
- 분석 명령: `python3 -I "$SKILL_ROOT/scripts/ref-analyze.py" ref/reference.mp4 -o ref/analysis.json --targets ref/targets.json`
- 레퍼런스 파일은 저장소에 커밋하지 않습니다. 숫자만 남깁니다.

## 편집 리듬

| 지표 | 값 | 이번 작품에 주는 뜻 |
|---|---|---|
| 컷 수, 분당 컷 (`edit.cutCount`, `edit.cutsPerMin`) | <값> | <뜻> |
| 평균 컷 길이, 길이 변동 (`edit.shotMeanS`, `edit.shotCV`) | <값> | <뜻> |
| 정지 프레임 비율 (`edit.stillShare`) | <값> | <뜻> |
| 평균 홀드, 가장 긴 홀드 (`edit.holdMeanS`, `edit.holdLongestS`) | <값> | <뜻> |
| 프레임 간 평균 차이 (`edit.meanDiff`) | <값> | <뜻> |

## 움직임

| 지표 | 값 | 이번 작품에 주는 뜻 |
|---|---|---|
| 평균 흐름, 상위 10% 흐름 (`motion.meanFlow`, `motion.p90Flow`) | <값> | <뜻> |
| 주된 방향 (`motion.dominantDir`) | <값> | <뜻> |
| 전환 피크 흐름, 전환이 움직이는 시간 (`motion.transitionPeakMean`, `motion.transitionMovingMeanS`) | <값> | <뜻> |
| 모션 블러 길이, 방향성 (`blur.alongPx`, `blur.anisotropy`) | <값> | <뜻> |

## 질감

| 지표 | 값 | 이번 작품에 주는 뜻 |
|---|---|---|
| 심도 띠 (`dof.bands`, `look.sharpRatio`) | <값> | <뜻> |
| 대비, 색 농도, 검정 수준 (`look.rms`, `look.chroma`, `look.black`) | <값> | <뜻> |
| 그레인 (`look.grain`) | <값> | <뜻> |

## 계획에 쓰는 목표

`ref/targets.json`의 지표와 허용 오차를 바꿨다면 무엇을 왜 바꿨는지 적습니다. 바꾸지 않았다면 "기본값 사용"이라고 적습니다.

- <목표 조정>

## 따라 하지 않을 것

레퍼런스에서 가져오지 않을 것(로고, 문구, 인물, 특정 장면 구성)을 적습니다.

- <따라 하지 않을 것>
