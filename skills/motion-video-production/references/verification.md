# 완성본 검증

`verify.sh`는 기존 단계 게이트를 대체하지 않습니다. `gate.py`의 미디어 검사에 엔진 검사와 눈 검수용 이미지를 한 표로 모읍니다. `final` 게이트는 여전히 실제 검수 기록과 그 기록이 최종본보다 새것인지 확인합니다.

## 실행

산출물 폴더의 `edit.json`을 기준으로 검사합니다. 엔진 종류는 상관없습니다.

```bash
bash "$SKILL_ROOT/scripts/verify.sh" "$PROJECT_ROOT/out/final.mp4" --project "$PROJECT_ROOT"
# 표의 LOOK 이미지를 실제로 보고 qa/review.md에 기록한 뒤:
python3 "$SKILL_ROOT/harness/gate.py" final "$PROJECT_ROOT"
```

Remotion 엔진을 복사한 폴더에서도 실행할 수 있습니다. 공유 게이트를 찾도록 설치된 스킬 경로를 넘깁니다.

```bash
npm run verify -- --production productions/carry-demo --video renders/carry-demo/final.mp4 --skill-root "$SKILL_ROOT"
```

기존 `PRODUCTION=productions/<id> bash "$SKILL_ROOT/scripts/verify.sh" <mp4>` 호출도 유지됩니다. `--project`와 `--production`이 함께 있으면 미디어의 기대값은 `edit.json`, carry는 작품의 `track.ts`를 씁니다. 둘 다 없으면 프레임 수는 스트림 헤더와만 비교하고, 목표 해상도·fps 비교는 SKIP입니다. 헤더와 맞는 짧은 파일도 있을 수 있으므로 납품에는 외부 기대값을 넘깁니다.

## 표 읽기

| 순서 | 검사 | 기준과 모드 |
|---|---|---|
| 0 | 엔진 단위 테스트 | 기존 테스트와 합성 타임라인 테스트. enforce |
| 1 | carry, 타임라인 | carry는 enforce. 2초 미만 간격의 오버레이는 다음 것이 불투명해질 때까지 유지, 카드 9초 이하, 원본 일시정지와 카드 연장 중첩 금지, 챕터 브리지 3.5초 이상은 observe |
| 2 | 컨테이너 | 기존 게이트의 프레임 수, 오디오 스트림, 해상도, fps, A/V 길이. enforce. 새 명목·평균 프레임률 비교는 observe |
| 3 | 음량 | 기존 게이트의 −14 ±1.5 LUFS, true peak ≤ −1 dBTP. enforce. `GATE_LUFS`, `GATE_LUFS_TOL`, `GATE_TP_MAX`로 변경 |
| 4 | 이음새 그림 | 원본과 너무 닮은 프레임(344×216 회색조 PSNR > 18 dB)을 찾음. observe |
| 5 | LOOK | 최대 60칸 컨택트 시트, 마지막 프레임. 사람이 볼 경로이며 PASS가 아님 |

`engines/remotion/pipeline/verify-limits.json`에 새 검사의 모드·기준이 있습니다. 새 검사는 observe에서 시작합니다. 실제 프로젝트에서 오탐을 확인하고 보정한 뒤 enforce로 바꿉니다. 기존 음량 기준은 이식 때문에 바꾸지 않았고, 수치와 계산은 계속 `harness/gate.py` 한 곳에 있습니다.

- PASS: 해당 기계 검사 통과. WARN: 관찰 모드의 실패 또는 참고 경고. SKIP: 입력·기대값이 없어 검사하지 못함. LOOK: 사람이 확인할 자료.
- enforce 실패는 종료 코드 1, 잘못된 입력은 2입니다. 기본은 실패한 비용 단계까지만 실행합니다. `--all`은 실패해도 모든 단계를 실행합니다.
- 영상 옆 `qa/VERIFY.md`에 표, 명령, 커밋, 영상 수정 시각·크기를 씁니다. 다시 인코딩하면 다시 검사해야 합니다. 이 파일은 눈 검수 기록이 아닙니다.
- 같은 검사에서 세 번 고쳐도 실패하면 시도한 것과 남은 실패를 사용자에게 보고합니다.

## 선택: 오버레이 계획과 원본 비교

`--plan <계획.json>`을 더하면 렌더 없이 타임라인을 검사합니다. 시간은 챕터의 **원본 초**입니다. `rows`는 실제 합성한 오버레이를 시작 시간순으로 적습니다. 자동으로 고쳐진 가상 계획으로 실제 편집을 통과시키지 않습니다.

```json
{
  "fps": 30, "fadeIn": 0.2, "fadeOut": 0.2,
  "chapters": [{
    "n": 1, "length": 12, "offset": 0, "bridgeAfter": 3.5, "pauses": [],
    "rows": [
      {"id": "title", "start": 0, "length": 4.7333, "clip": 4, "fadeIn": false, "fadeOut": false},
      {"id": "detail", "start": 4.5, "length": 4, "clip": 4, "fadeIn": true, "fadeOut": true}
    ]
  }]
}
```

`clip`은 움직이는 클립 길이, 그보다 긴 `length`는 마지막 프레임 유지입니다. `fadeIn`·`fadeOut`은 페이드 유무이고, 페이드 길이는 최상위 초 값입니다. `pauses`에는 `{"at": 5, "seconds": 2, "id": "card"}`처럼 원본을 멈춘 위치와 추가 길이를 적습니다. `offset`은 최종본에서 챕터가 시작하는 초, `bridgeAfter`는 챕터 뒤 브리지 길이입니다. 마지막 챕터처럼 브리지가 없으면 생략합니다.

또는 `rows` 대신 `items`에 `{"id": "title", "start": 0, "end": 4, "clip": 4}`를 넣어 배치·유지 결과를 계산할 수 있습니다(`end: null`이면 클립 길이). 이 방식은 합성기가 같은 `composed()` 결과를 사용하거나 실제 결과와 대조했을 때만 검증 근거가 됩니다. 기존 `edit.json`의 `cuts`와는 다른 오버레이 계약입니다.

`--src <원본.mp4>`까지 주면 한 챕터 계획에 한해 이음새 주변 0.8초를 원본과 비교합니다. 최종본과 원본은 같은 화면 크롭·속도여야 합니다. 추가 일시정지를 가로지르는 창은 시간 대응이 달라 건너뛰고 개수를 표시합니다. 이 검사는 이음새 표본 밖의 플래시를 보장하지 않습니다. 프레임률 비교도 명목·평균 값 비교이며 모든 타임스탬프를 검사하지는 않습니다.

## 사람이 남겨야 하는 것

컨택트 시트와 마지막 프레임에서 겹침·잘린 글자·얼굴과 의상 변형을 보고, 컷 전후 영상과 오디오도 직접 재생합니다. 컷이 말의 내용에 맞는지, 음악이 자연스러운지는 이 표로 판정하지 않습니다. 실제로 본 뒤에만 `qa/review.md`에 `REVIEWED: <이름> <YYYY-MM-DD>`와 본 결과를 씁니다.

이 표는 렌더·유료 생성·받아쓰기를 실행하지 않습니다. 이전 `verify.sh`의 반복 체크섬·가장자리 RGB 출력과 자동 whisper 호출은 빠졌습니다. 움직임 중 반복 여부는 영상과 스트립으로, 대본 일치는 별도 받아쓰기로 확인합니다. 짧은 소스 숏 감지, 구간별 음악 균형, 렌더 결정성도 검사하지 않습니다.
