# 사운드 디자인 브리프 (`productions/<id>/audio/BRIEF.md`로 복사해 `<…>`를 채움)

엔진에 들어 있는 `pipeline/score.mjs`는 `timing.ts`의 `MUSIC`(BPM, 길이, 타격 시각, 대사 구간)만으로 패드·킥·타격을 만드는 기본 스코어입니다. 더 공들인 음악이 필요하면 이 브리프를 코딩 에이전트(워커)에게 줍니다.

당신은 <N>초짜리 영상의 사운드 디자이너입니다. 화면에 정확히 맞는 오리지널 스코어와 효과음을 절차적으로 합성합니다.

## 먼저 읽기
- `../timing.ts`: 타이밍 계약. `import { <ID> } from '../timing.ts'`가 Node 24에서 동작합니다(타입 제거). 모든 시각은 여기서 가져오고 초를 직접 쓰지 않습니다.
- `../BEATSHEET.md`: 비트마다 일어나는 일과 각 경계를 넘는 요소. carry가 착지하는 순간에 맞춥니다.

## 환경 (꼭 지킬 것)
- 작업 폴더는 이 폴더(`productions/<id>/audio/`)이고 여기에만 씁니다.
- Node.js 24 기본 모듈만(npm 설치, Python 없음). 확인용으로 `ffmpeg`, `ffprobe`를 씁니다.
- 네트워크·샘플 없음. 전부 합성(오실레이터, 노이즈, 엔벨로프, 필터). PRNG 시드 고정.

## 산출물
1. `score.mjs`: 결정적. `node score.mjs`가 옆에 `score.wav`를 씁니다(경로는 `import.meta.url` 기준).
2. `score.wav`: 48kHz, 스테레오, 16비트 PCM, 정확히 `<ID>.seconds * 48000` 샘플.
3. `NOTES.md`: 모든 이벤트의 샘플 단위 시작 시각과 아래 확인 출력 원문.

## 팔레트 (<스타일>)
<예: 깔끔한 제품: 둥근 킥, 부드러운 하이햇, 따뜻한 서브, 뜯는 모티프, 디튠 톱니 패드.>
- 대사가 위에 얹힙니다. 대사 구간 안에서 1~4kHz를 얇게 둡니다.
- 화면이 완전히 멈추면 음악도 얇아지거나 멈춥니다.
- 마스터는 소프트 클립과 리미터로 마무리합니다.

## 확인 (실행하고 출력 원문을 NOTES.md에 붙임)
```
ffprobe -v error -show_entries stream=sample_rate,channels,duration_ts -of default=nw=1 score.wav
ffmpeg -hide_banner -i score.wav -af loudnorm=print_format=summary -f null - 2>&1 | tail -14
ffmpeg -hide_banner -i score.wav -af volumedetect -f null - 2>&1 | grep max_volume
```
통과: sample_rate=48000, channels=2, duration_ts=<N × 48000>, max_volume ≤ −3.0dB, "Input Integrated"가 −20~−16 LUFS. 실패하면 생성기를 고쳐 다시 돌리고 WAV를 손으로 고치지 않습니다. 오케스트레이터는 이 숫자를 따로 다시 잽니다.
