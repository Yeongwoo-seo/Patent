# 자연과학 720문항 전체 (변환된 실제 콘텐츠)

`astra-import/tools/convert_astra_samples.py`로 실제 Astra 자연과학 최종
콘텐츠 패키지(720문항, 2009~2026, 실제 기출·기본서 본문·제공 해설)를
회독실 앱의 content-package 포맷으로 변환한 결과물이다.

**실제 저작물(원문·해설)이 포함되어 있다.** 원본 패키지의
`licenseScope: "personal-exam-prep-restricted"`가 이 데이터에도 그대로
적용된다 — 개인 시험 준비 용도로만 사용한다. 이 저장소를 public으로 유지할지,
이 콘텐츠를 커밋할지는 사용자가 명시적으로 확인했다(`docs/DECISIONS.md`).

가져오는 방법: 앱의 설정 탭 → "콘텐츠 패키지 가져오기"에서 이 디렉터리
(`manifest.json` + `data/*.jsonl` + `assets/*`)를 통째로 선택한다. Chromium
스모크 테스트로 파싱 0오류·검증 0이슈·dry-run/적용(신규 1,370건)까지
확인했다(`docs/QA_REPORT.md`).
