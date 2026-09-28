# IMPORT_RULES.md — 기존 학습 기록을 덮어쓰지 않는 수입·업데이트 규칙

이 패키지를 가져오거나 다음 버전으로 갱신할 때 지켜야 할 규칙이다. 브리핑
7.4/19.3/20.4의 원칙을 이 패키지에 구체적으로 적용한 것이다.

## 0. 이 패키지가 건드리는 저장소 / 건드리지 않는 저장소

- **건드림(콘텐츠 저장소만)**: `learningItems`, `gradingSpecs`, `durationRules`,
  `textbookParagraphs`, `contentLinks`, 자산.
- **절대 건드리지 않음(학습 이력 저장소)**: `attemptEvents`, `exposureEvents`,
  `reviewStates`, `syncOutbox`, `annotations`, `plannerBlocks`, `timeSegments`,
  `dailyPlans`. 이 패키지의 import는 콘텐츠 교체이지 이력 마이그레이션이 아니다.

## 1. ID는 재사용하되 의미는 재사용하지 않는다

같은 `id`가 이미 존재하면:

1. **오탈자·서식만 바뀜** (질문/정답/조건의 의미가 그대로): `contentRevisionId`만
   올리고 `learningEpoch`는 유지한다. 기존 `ReviewState`(해당 `learnerId + id +
   learningEpoch`)는 그대로 두고 재계산하지 않는다.
2. **정오·적용 조건·주요 의미가 바뀜** (정답이 바뀌거나, 채점 기준이 바뀌거나,
   그림/조건이 실질적으로 달라짐): **반드시 `learningEpoch`를 증가**시켜 새
   학습 버전을 만든다. 이전 `learningEpoch`의 `ReviewState`와 `AttemptEvent`는
   그대로 보존한다. 새 `learningEpoch`에는 새 `ReviewState`가 `status:
   'needs_verification'` 또는 `'new'`로 시작한다 — 이전 단계·다음 복습일을
   이어받지 않는다.
3. 어느 경우든 **기존 레코드를 지우고 새 랜덤 id로 다시 넣지 않는다.** id는
   영구 식별자다.

## 2. 삭제 대신 superseded

패키지의 새 버전에서 어떤 `id`가 빠지면, 그 `id`를 참조하는 기존 학습 기록이
있는지 먼저 확인한다.

- 참조가 있으면: 레코드를 삭제하지 않고 "원문 미가용" 상태로 표시할 방법이
  필요하다(예: 콘텐츠 저장소에 `status: 'removed_upstream'` 같은 필드 추가).
  **이 필드는 아직 앱에 없다** — 수입기를 실제로 구현할 때 함께 추가해야
  한다(`docs/KNOWN_LIMITATIONS.md`에 기재).
- 참조가 없으면 안전하게 제거할 수 있다.

## 3. legacyIdMap을 실제로 쓴다

이 패키지의 `manifest.json.legacyIdMap`은 비어 있다(신규 생성이라 이전
시스템 ID가 없음). 이후 실제 기출 원문에 자체 ID 체계가 있다면, 그 ID를
`legacyIdMap`에 채워 이 패키지의 `id`와 연결하고, 배열 순번·파일명으로 새
ID를 만들지 않는다(4.1).

## 4. dry-run → 승인 → 원자적 반영

1. 새 패키지를 받으면 먼저 `tools/validate-package.mjs`를 돌려 기계 검증부터
   통과시킨다.
2. 그다음 "몇 개가 추가/변경/충돌하는지" 미리보기를 만들어 사람이 승인한
   뒤에만 실제 저장소에 반영한다(20.2 dry-run).
3. 반영은 한 트랜잭션으로 하거나, 실패 시 이전 정상 콘텐츠로 롤백할 수 있게
   한다. 절반만 반영된 상태로 남기지 않는다.

## 5. 검증 상태는 가져오는 쪽이 임의로 올리지 않는다

`verification: 'unverified'`나 `'needs_review'`인 레코드를, 그 근거(사람의
확인, 공식 자료)가 없는데 `'verified'`로 바꾸지 않는다. AI가 그럴듯하다고
판단했다는 이유만으로 격상시키지 않는다(7.2). `REVIEW_QUEUE.md`의 항목은
사람이 확인한 뒤에만 상태를 바꾼다.

## 6. 선택지·보조 파일도 같은 원칙

`data/choice-options.jsonl`, `data/source-assets.jsonl`도 콘텐츠의 일부다.
정답 선택지의 텍스트가 바뀌면(의미가 바뀌면) 해당 `GradingSpec`/`LearningItem`과
같은 규칙(1번)을 따른다 — 선택지 텍스트만 슬쩍 바꾸고 학습 이력을 그대로
두면 사용자가 이미 확인한 정답의 의미가 소급 변경될 수 있다.
