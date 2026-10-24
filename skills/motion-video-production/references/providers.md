# 도구별 사용 메모

도구의 화면과 명령은 자주 바뀝니다. 아래는 사용 방식의 일반 원칙이고, 구체 옵션은 각 도구의 현재 문서를 확인합니다. 로그인·결제·키 입력은 사용자가 직접 하며 에이전트가 대신하지 않습니다.

## 이미지: 캐릭터 시트와 키프레임
- ChatGPT 웹 또는 Grok Imagine 이미지 생성으로 만듭니다.
- 웹에서 만든 이미지는 다운로드 버튼으로 직접 저장합니다.
- 캐릭터 시트 프롬프트 틀:
  > 캐릭터 1명의 포즈 시트, 16:9, 정면·측면·뒷면과 표정 6종을 한 장에, 배경은 단색, 글자·라벨 없음. 캐릭터(모든 칸에서 동일): <외형 고정문>.
- 키프레임 프롬프트 틀: `<외형 고정문> + <장면의 시간대·장소·행동 1개·카메라 구도>`.
- 화면 안에 읽히는 글자, 로고, 제품 화면을 넣지 않기로 했다면 프롬프트에 "화면에는 추상적인 빛만 표시, 글자 없음"을 넣습니다.

## 영상: 키프레임 -> 클립
- 시작 화면(first frame)에 키프레임을, 참조 이미지에 캐릭터 시트를 넣습니다.
- 클립 길이는 3~6초, 해상도는 플랜에서 허용하는 최대값으로 지정합니다.
- 프롬프트는 "카메라 고정 또는 단순한 카메라 이동 + 행동 1개 + 끝 상태"의 형태로 씁니다.
- 초록 배경으로 생성할 때: "perfectly flat green background, nothing left on the ground"를 넣습니다. 영상 모델이 바닥에 소품을 만들어 내는 경우가 있어 `key-plate.sh`의 마스크 옵션으로 해당 프레임 구간만 지웁니다.
- 여러 클립을 병렬로 생성할 때는 한 번에 소수(3~5개)씩 돌리고, 결과는 모두 `clipsheet.sh`로 검수합니다.

## 음악
- Suno 등 음악 생성 도구에서 시안을 여러 개 만들고, 곡의 드롭 위치와 BPM을 확인한 뒤 `beat-grid.md`의 방식으로 격자에 조립합니다.
- 생성 도구의 BPM 표기는 실제와 다를 수 있으므로 `beat-grid.md` 조립 규칙 5의 방법으로 재서 확정합니다.
- 상업 공개용은 유료 플랜에서 생성한 파일을 씁니다. (`references/licensing.md`)

## 목소리
- ElevenLabs, Fish Audio 등에서 음성 1개를 선택하고 ID를 `voices.json`(또는 `.env`가 아닌 프로젝트 설정 파일)에 기록합니다.
- 숫자와 고유명사는 읽히는 대로(한글 표기) 적고 자막에는 원래 표기를 씁니다.
- 합성 후 whisper로 받아쓰기해 대본과 비교하고, 틀린 줄만 다시 생성합니다. 크레딧이 소모되므로 이미 생성된 파일은 다시 생성하지 않습니다.
- 유명인·정치인·저작물 캐릭터의 복제 음성은 사용하지 않습니다.
- 무료 플랜에서 API로 쓸 수 없는 음성이 있을 수 있습니다. 이 경우 기본 제공 음성을 쓰거나 웹에서 생성합니다.

## 받아쓰기 (검수용)
- `pip install openai-whisper` 후 `whisper <wav> --model small --language ko`.
- 모델 파일은 수백 MB이므로 다운로드 전에 사용자에게 알립니다.
- 단어 단위 시간이 필요하면 `--word_timestamps True --output_format json`을 씁니다.

## 목소리 자동화: composio CLI (`engines/remotion/pipeline/vo.mjs`)
- 계정 확인: `composio link elevenlabs --list`, `composio link fish_audio --list`. ACTIVE가 없으면 `composio link <toolkit>`으로 사용자가 직접 연결합니다.
- `vo.mjs`는 실행할 때 계정을 고릅니다. ACTIVE 연결이 하나면 그것을, 여러 개면 `voices.json`의 `"account"`나 환경 변수 `COMPOSIO_ACCOUNT_ELEVENLABS`, `COMPOSIO_ACCOUNT_FISH`를 씁니다. 저장소에는 계정을 적지 않습니다.
- `productions/<id>/vo/script.json`(`id, who, text, caption`)과 `voices.json`을 채우고 `node pipeline/vo.mjs productions/<id>/vo`를 돌립니다. 없는 줄만 생성합니다. 호출마다 크레딧이 들므로 실행 전에 사용자에게 알립니다.
- **ElevenLabs**(`ELEVENLABS_TEXT_TO_SPEECH`, 모델 `eleven_v3`): 무료 플랜은 API로 라이브러리 음성을 쓸 수 없습니다("paid_plan_required"). 기본 제공 음성을 씁니다. 실존 인물의 복제처럼 보이는 음성은 고르지 않습니다.
- **Fish Audio**(`FISH_AUDIO_LIST_VOICE_MODELS`, `FISH_AUDIO_SYNTHESIZE_SPEECH`): 캐릭터 목소리에 좋습니다. 유명인·정치인·아이돌·저작물 캐릭터의 복제는 고르지 않습니다.
- 큰 응답은 `{outputFilePath}` 파일로 옵니다(`vo.mjs`가 읽습니다).
- 받은 줄은 `node pipeline/vo-assemble.mjs <vo폴더> <초> <cues.json>`으로 다듬고, 라우드니스를 맞추고, 시각에 배치해 `vo_track.wav` 하나로 만듭니다.
- 고유명사가 가장 잘 틀립니다. 소리 나는 대로 적고, 받아쓰기로 확인하고, 다른 시드로 다시 받거나 좋은 테이크에서 그 구절만 잘라 붙입니다.

## 초록 배경 캐릭터 애니메이션: Grok CLI
- `reference_to_video`에 `first_frame`(16:9 초록 배경 포즈 한 장)과 `images`(포즈 시트)를 함께 넣으면 생김새가 유지됩니다. 해상도는 720p로 지정합니다(기본값은 480p). 약 24fps가 나옵니다.
- 프롬프트에 "perfectly flat, evenly lit chroma-key green background with a locked-off static camera", "the character stays fully in frame; nothing is left on the ground"를 넣습니다.
- 마지막 장면은 이전 클립의 마지막 프레임(`ffmpeg -sseof -0.1 -i clip.mp4 -frames:v 1 end.png`)을 `first_frame`으로 다시 생성합니다.

## 음악 워커
- 기본 스코어는 `node pipeline/score.mjs productions/<id>`입니다. 더 공들인 음악은 `templates/MUSIC_BRIEF.md`를 채워 코딩 에이전트에게 맡기고, 결과의 샘플 수·라우드니스·피크·타격 시각을 직접 다시 잽니다. 워커의 종료 코드 0만으로 성공이라고 보지 않고 로그 끝을 읽습니다.
