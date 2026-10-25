# SMOKE — 유료 API 없이 실행 가능한 것 전수 테스트 (2026-10-23)

대상: `skills/motion-video-production/{scripts,templates,engines,templates}` 의 실행 파일.
`engines/hyperframes/node_modules/**` 는 검사에서 제외했다(제3자 배포물).

## python3 -I <script> --help

| 명령 | 종료 코드 | 비고 |
|---|---|---|
| `python3 -I scripts/beat-grid.py --help` | 2 | 설계대로: 인자 오류 시 사용법 출력 후 2 (`gate.py` 와 같은 규약) |
| `python3 -I scripts/dupcheck.py --help` | 2 | 수정 후. 수정 전에는 `--help` 를 파일로 열어 traceback(exit 1). `-h/--help` 를 사용법 출력으로 처리하게 고침 |
| `python3 -I scripts/ref-analyze.py --help` | 1 | `ModuleNotFoundError: cv2`. 의존(`requirements-ref.txt`: opencv-python-headless, numpy)을 이 머신에 설치하지 않아 환경 문제. 스크립트 버그 아님 |

기능 확인(추가): `beat-grid.py grid 144 4` / `snap 144 1.7` exit 0, `dupcheck.py` 로 반복 컷 2개짜리 edit.json 이 REPEAT exit 1 정상 판정.

## node --check (.mjs/.js, node_modules 제외)

전부 exit 0: `engines/remotion/pipeline/{probe,render,score,vo,vo-assemble}.mjs`, `engines/remotion/productions/wordcut/{render,plan,drift,look,look-fit}.mjs`.

## bash -n

전부 exit 0: `harness/selftest.sh`, `scripts/{verify,mix-mux,clipsheet,key-plate}.sh`.

## 문서화된 셀프테스트

`bash harness/selftest.sh` — 약 2분 소요, exit 0, ok 55건 / FAIL 0건, `skip ICC 회귀 사례 (PIL 없음)`.
(처음 120초 제한으로 돌았을 때는 타임아웃처럼 보였지만 실제로는 정상 완료 작업이었다.)

`python3 -I harness/gate.py` (인자 없음) — 사용법 출력 exit 2, 정상.

## 고친 것

- `scripts/dupcheck.py`: `-h`/`--help` 를 사용법 출력으로 처리(수정 전 traceback).

## 발견했지만 그대로 둔 것

- `ref-analyze.py` 는 cv2·numpy 설치가 필요하다(이 머신에 없음). 설치하면 재검사 필요.
- `selftest.sh` 의 ICC 회귀 사례는 PIL 이 없어 건너뛴다.
