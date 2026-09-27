# DATA_MIGRATION_REPORT.md

## 요약

이번 세션 시작 시점에 저장소에는 **기존 데이터가 전혀 없었다**(`docs/IMPLEMENTATION_AUDIT.md`
참고: 커밋 0개, 파일 0개). 따라서:

- 보존해야 할 기존 ID: 없음
- 보존해야 할 기존 학습 이력: 없음
- 실행한 마이그레이션: 없음(스키마 버전 1을 처음 생성)

## 이번 세션에 만든 초기 스키마

IndexedDB 데이터베이스 `hoedokshil`, 버전 `2`(`src/data/indexeddb/schema.ts`,
`src/data/indexeddb/db.ts`)에 다음 object store를 생성했다. v1은 핵심 학습
엔진 store, v2는 같은 세션 안에서 9장 리더용 store 3개를 추가한 것이며,
`upgrade(db, oldVersion)`의 `oldVersion` 분기로 처리해 기존 store를 다시
만들거나 지우지 않는다(21.2).

| store | keyPath | 용도 |
|---|---|---|
| `attemptEvents` | `eventId` | 풀이 이벤트(append-only) |
| `exposureEvents` | `eventId` | 읽기/청취/힌트/정답노출 이벤트 |
| `reviewStates` | `[learnerId, itemId, learningEpoch]` | 복습 상태 파생값 |
| `learningItems` | `id` | 학습 항목 정의(데모 데이터) |
| `gradingSpecs` | `id` | 채점 기준 |
| `durationRules` | `id` | 기간 암기 카드 |
| `syncOutbox` | `outboxId` | 동기화 대기열(발송 로직은 미구현) |
| `timeSegments` | `id` | 실제 학습 시간 원본(현재 미사용 — 세션 타이머 미연동) |
| `plannerBlocks` | `id` | 10분 블록 표시용 |
| `dailyPlans` | `[learnerId, studyDay, planVersion]` | 일일 계획(현재 메모리에서만 사용, 저장 연동은 다음 세션 과제) |
| `textbookParagraphs` (v2) | `id` | 기본서 문단(9장 리더, 3개 과목 대표 예시만) |
| `contentLinks` (v2) | `id` | 학습 항목 ↔ 문단 다대다 연결(4.1) |
| `annotations` (v2) | `id` | 사용자 형광펜/메모(9.1, 원본과 분리 저장) |

시딩 데이터는 `src/data/fixtures/demoContent.ts`의 **테스트용 가상 자료**뿐이며,
`seedDemoContentIfEmpty()`가 `learningItems` store가 비어 있을 때만 1회 실행한다
(20.6: "데모는 운영 진도·실제 기출 통계와 섞이지 않는다").

## 실 데이터 수입 시 필요한 작업 (다음 세션)

실제 기출/조문/판례/기본서 파일을 전달받으면:

1. `docs/IMPLEMENTATION_AUDIT.md`를 그 시점 기준으로 다시 작성(실제 발견한
   파일·포맷·수량 기록).
2. 20.2절의 파이프라인(manifest 검증 → dry-run → 승인 → 반영)을 구현.
3. 기존 파일에 ID가 있으면 `legacyIdMap`으로 보존, 없으면 신규 고정 ID를 발급하되
   배열 순번/파일명을 영구 ID로 쓰지 않는다(4.1).
4. 이 문서를 갱신해 실제 수입 수량/누락/충돌을 기록한다(20.5의 검수 보고 항목:
   발견 자료/수입 성공/미수입/중복/누락 그림/정답 미확보/현재법 미검증/문단 연결
   실패/기존 기록 연결 실패).

현재는 위 항목 전부가 "해당 없음(데이터 없음)"이다.
