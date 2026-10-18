# Continuity: 고정 외형, 장면 연결, 수동 SceneSteller 연계

`continuity.json`은 선택 사항이며 **이 저장소의 로컬 규격**이다. SceneSteller 네이티브 프로젝트 형식, API, 자동 업로드 포맷이 아니다. 파일이 없는 기존 제작 흐름은 그대로 사용할 수 있다.

SceneSteller 공식 [홈페이지](https://www.scenesteller.com)는 캐릭터 시트, 스토리보드, 타임라인, 내보내기를 소개한다. [비교 페이지](https://www.scenesteller.com/compare/scenesteller-vs-dalle)는 API Access를 Coming soon으로 표시한다. [서비스 약관](https://www.scenesteller.com/terms-of-service)은 자동 시스템·봇·스크래퍼 접근을 금지한다. 따라서 이 도구는 **네트워크·로그인·브라우저 자동화 없이 로컬 인계 자료만 생성**한다. 사용자가 직접 UI에서 작업하고 내려받은 미디어를 명시적으로 매핑하여 가져온다. 네이티브 프로젝트 import/export 스키마와 시작/끝 프레임 입력 지원은 확인되지 않았다. 실제 생성 서비스·모델의 지원을 먼저 확인한다. (확인: 2026-10-08)

## 준비

`templates/CONTINUITY.json`을 프로젝트의 `continuity.json`으로 복사하고 예시 내용을 바꾼다.

- `version`: `1`.
- `character_lock`: 기존 외형 고정문 파일. 공백·줄바꿈을 포함한 원문을 모든 장면 프롬프트에 그대로 반복한다.
- `reference_sheet`: 외형 확인용 로컬 이미지.
- `style_lock`: 모든 장면에 그대로 반복할 스타일 문장.
- `scenes`: 1~200개, 고유 `id`는 영문·숫자로 시작하고 영문·숫자·`_`·`-`만 허용(64자 이하).
- `start_keyframe`: `key/<id>.png`, `clip`: `clip/<id>.mp4`.
- `end_keyframe`: 선택 사항, 지정한다면 `key-end/<id>.png`. 지원되지 않는 생성기에 끝 프레임 기능이 있다고 가정하지 않는다. 검수용 목표 이미지로만 써도 된다.
- `duration`: 예상 생성 길이(유한 양수). 실제 편집 구간은 `edit.json`을 따른다.
- `action`, `camera`, `end_state`, `screen_direction`: 장면 동작·카메라·마지막 상태·화면상 이동 방향을 구체적으로 기록.
- `transition_to_next`: `hard_cut` / `match_cut` / `continuous`. 검수 의도를 나타내며 서비스 전환 효과를 자동 적용하지 않는다. 마지막 장면 값은 다음 장면이 없으면 사용하지 않는다.

경로는 프로젝트 내부 상대 경로만 허용한다. `..`, 절대 경로, 심볼릭 링크는 거절한다. 결과는 항상 새 경로에 쓰며 기존 파일은 덮어쓰지 않는다. 아래 명령의 스크립트 경로는 설치 위치에 맞춘다.

## 로컬 인계 및 가져오기

```sh
python3 scripts/continuity.py export /path/to/project --out handoff/scenesteller-v1
```

출력: `scene-prompts.md`, 이 저장소 규격의 `manifest.json`, `mapping-template.json`, 존재하는 로컬 미디어와 고정문을 복사한 `assets/`, `assets-sha256.json`. 아직 생성하지 않은 키프레임·클립은 생략한다. 외형 고정문과 참조 시트는 먼저 준비해야 한다. 사용자가 SceneSteller UI에서 프롬프트와 자료를 직접 사용한다.

사용자가 내려받은 결과를 프로젝트 `downloads/`에 넣는다. `mapping-template.json`을 참고해 프로젝트 내부에 아래와 같은 `import-map.json`을 작성한다. 파일명 추측이나 순서 기반 연결 없이 장면 ID와 자산 종류를 지정한다.

```json
{"version":1,"assets":[
  {"scene_id":"01","kind":"start_keyframe","source":"downloads/scene-one.png"},
  {"scene_id":"01","kind":"clip","source":"downloads/scene-one.mp4"}
]}
```

```sh
python3 scripts/continuity.py import /path/to/project --mapping import-map.json
```

`kind`는 `start_keyframe`, `end_keyframe`, `clip` 중 하나다. PNG와 MP4만 지정하며 자동 변환하지 않는다. 모든 매핑을 복사·미디어 검사한 뒤 목적지에 반영한다. 하나라도 오류가 있으면 자산을 반영하지 않고, 반영 중 실패하면 이 실행에서 만든 파일을 회수한다. 기존 목적지 파일이 있으면 차단한다. 재시도에는 새 프로젝트나 사용자가 직접 정리한 경로를 사용한다.

## 비교 시트와 검수

```sh
python3 scripts/continuity.py sheet /path/to/project --kind keyframes --out qa/keyframes-v1
python3 scripts/continuity.py review-template /path/to/project --kind keyframes --sheet qa/keyframes-v1
python3 scripts/continuity.py sheet /path/to/project --kind boundaries --out qa/boundaries-v1
python3 scripts/continuity.py review-template /path/to/project --kind boundaries --sheet qa/boundaries-v1
python3 scripts/continuity.py check /path/to/project
```

`keyframes`는 참조 시트↔각 시작/끝 키프레임과 인접 장면 끝↔다음 시작을 비교한다. 끝 이미지가 없으면 이전 시작 이미지를 쓴다. 이 경우 동작의 종료 상태까지 확인했다는 뜻은 아니다.

`boundaries`는 `edit.json`의 `cuts`를 시간순으로 정렬해 **실제로 쓰는 구간**을 비교한다. `src=clip:<id>@<offset>`과 `rate`를 적용한다. 이전 컷 샘플은 `offset + max(0, d - 1/fps) × rate`, 다음 컷 샘플은 다음 컷의 `offset`이다. 즉 원본 클립의 무조건적인 첫/끝 프레임을 쓰지 않는다. 간격·겹침·범위 초과를 검사한다. 한 컷뿐이면 사용 구간의 시작↔끝을 비교한다. 컷 길이가 프레임 격자에 맞지 않으면 프레임 선택은 디코더의 타임스탬프 해석에 따르므로 기존 편집 게이트도 함께 실행한다.

각 결과 폴더는 `pair-001.png` 등의 좌→우 비교 이미지와 소스 경로·초 단위 시각을 기록한 `index.json`, 읽기용 목록을 포함한다. 이미지에 번호를 그려 넣지는 않으며 파일명과 목록으로 대응한다. 프레임 추출 실패 시 완성된 시트로 게시하지 않는다.

검수 템플릿은 `qa/continuity-keyframes-review.json` / `qa/continuity-boundaries-review.json`에 **PENDING만 생성**한다. 실제 사람 검수 후 `status`를 `REVIEWED`, `reviewer`를 검수자 이름, `date`를 `YYYY-MM-DD`, 각 pair의 `verdict`를 `ACCEPT` 또는 `REJECT`로 수정하고 판단 근거를 `notes`에 쓴다. 외형·얼굴·복장·소품·빛·구도·카메라 축·화면 방향·동작 종료/시작 상태를 확인하고 전환 의도와 맞는지 판단한다. 정지 시트만으로 움직임의 자연스러움을 확인할 수 없으므로 실제 연결 재생도 확인한다.

`check`는 PENDING·REJECT·누락·해시 변경을 차단한다. 키프레임 검수는 매니페스트·고정문·참조 시트와 `sheet/`, `key/`, `key-end/` 전체 입력을 묶는다. 경계 검수는 여기에 `clip/` 전체 입력과 `edit.json`까지 포함한다. 두 검수 모두 생성된 비교 시트도 해시로 묶는다. 해당 범위에 새 미디어를 추가하면 기존 검수는 만료되며, 클립 생성이나 편집 추가만으로 키프레임 검수가 만료되지는 않는다. 원본이 바뀌면 새 시트를 만들고 기존 리뷰를 사용자가 보관/이동한 뒤 새 PENDING 템플릿을 만들어 다시 검수한다. 자동 수치나 게이트 PASS가 시각적 부드러움 또는 캐릭터 동일성을 보장하지 않는다.

`check_project(root)`는 게이트 통합용 `(level, id, message)` 튜플 목록을 돌려준다. 매니페스트가 없으면 CT00 PASS로 선택 기능을 건너뛴다. 있으면 키프레임 검수를 요구하고, `edit.json`도 있으면 경계 검수까지 요구한다. `ffmpeg`, `ffprobe`, Python 3.7+ 표준 라이브러리만 사용한다.
