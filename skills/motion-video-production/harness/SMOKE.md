# SMOKE — 유료 API 없이 실행 가능한 검사

## 2026-11-17 검증 표 이식

macOS, Node 26.13.0, Python 3.15.2. 의존 설치·Remotion 렌더·유료 호출 없이 실행했습니다.

| 명령 | 결과 |
|---|---|
| `bash harness/selftest.sh` | exit 0, 기존 합성 미디어 사례 55건 통과, ICC 사례 1건 건너뜀(Pillow 없음), 아래 Node 테스트도 실행 |
| `node --test timeline/core.test.mjs harness/*.test.mjs` | 20 tests, 20 pass, 0 fail (타임라인 10, 경로·이름 3, 검증 표 7: 상위 묶음 1 + 사례 6) |
| Remotion 엔진의 `npm test` | 21 tests, 21 pass, 0 fail (기존 15 + 합성 타임라인 6) |
| 모든 배포 `.mjs`의 `node --check` | exit 0 |
| `bash -n harness/selftest.sh scripts/verify.sh` | exit 0 |
| `python3 -m py_compile harness/gate.py` | exit 0 |

검증 표 테스트는 작은 합성 영상으로 기존 셸 호출, 복사한 엔진, 프레임 수 실패와 조기 중단·`--all`, observe 경고, 노출된/덮인 이음새의 PSNR, 잘못된 입력, LOOK 이미지와 VERIFY.md 기록을 확인합니다. 경로 테스트는 스킬·레퍼런스·README에 백틱으로 적은 정적 배포 경로와 스킬 폴더/이름 일치를 확인합니다. 프로젝트 산출물, 명령, 글롭, 자리표시자 경로는 제외합니다.

기존 단계 게이트와 새 표는 같은 미디어 함수를 씁니다. 새 타임라인·그림·명목/평균 프레임률 검사는 observe이고, 기존 음량 기준과 검수 기록 요구는 유지했습니다.

확인하지 않은 것: 의존이 없는 상태의 TypeScript 전체 타입 검사, 설치기·런타임 발견 재검사, Remotion 렌더, 외부 생성, 오디오 청취, 실제 작품에 맞춘 PSNR 보정. 이전 `verify.sh`의 반복 체크섬·가장자리 RGB·자동 받아쓰기는 새 표에서 실행하지 않습니다. 명령과 한계는 `references/verification.md`에 있습니다.

## 이전 검사 (2026-10-23)

- `python3 -I scripts/beat-grid.py --help`, `dupcheck.py --help`: 사용법 출력 exit 2. beat-grid의 grid/snap은 exit 0, 반복 컷은 dupcheck exit 1.
- `ref-analyze.py --help`: cv2 미설치로 exit 1. OpenCV와 numpy 설치 후 재검사 필요.
- 당시 배포 `.mjs` 구문 검사와 셸 `bash -n`: exit 0.
- 당시 `harness/selftest.sh`: exit 0, ok 55건, ICC 회귀는 Pillow가 없어 건너뜀.
