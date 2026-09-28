# REVIEW_QUEUE.md

이 목록은 `tools/generate-review-queue.mjs`가 데이터의 `verification` 필드를 그대로 읽어
만든 것이다 - 사람이 아직 확인하지 않았거나(`unverified`/`needs_review`), 정답 기준
자체가 없는 항목이다. **이 문서에 오른 것은 전부 이번 세션 기준 "완료가 아님"이다.**

앱은 `verification !== "verified"` 항목을 자동 채점 퀘스트 후보에서 제외하도록 되어
있다(브리핑 7.3, 12.3-2) - 즉 여기 있는 항목은 원문 열람은 가능해도 자동 채점/간격
확대에는 쓰이지 않는다.

총 10건 (learning_item 8건, duration_rule 2건)

## civil (2건)

- **demo-civil-statement-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified
- **demo-civil-statement-2** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified

## design (1건)

- **demo-design-procedure-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified

## earth_science (1건)

- **demo-earth-diagram-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=needs_review

## patent (3건)

- **demo-patent-procedure-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified
- **demo-patent-duration-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified
- **demo-duration-patent-examination-request** (duration_rule) — validity.verification=unverified; whyEvidenceType=pedagogical_inference

## trademark (1건)

- **demo-trademark-case-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=needs_review; 정답(correctOxValue) 미확보

## utility (2건)

- **demo-utility-duration-1** (learning_item) — 항목 자체 verification=unverified; 채점기준 verification=unverified
- **demo-duration-utility-examination-request** (duration_rule) — validity.verification=unverified; whyEvidenceType=unavailable

## 참고: 검토가 필요 없는 항목 (기계적으로 통과)

- learning_item: 6개는 verification=verified이고 채점기준도 verified다.
  (물리·화학·생물 계산/개념 항목 — 정답이 산술적으로 결정적이라는 뜻이지,
  "실제 기출로 확인됨"이라는 뜻은 아니다. 모든 콘텐츠는 여전히 테스트용 가상 자료다.)

## 사람이 해야 할 일 (기계가 대신할 수 없음)

1. 민법 2건: 판례 법리 설명이 실제 판례 법리와 일치하는지 확인(현재는 가상 설명).
2. 특허/실용신안/디자인 5건 + 기간 카드 2건: 실제 조문 번호·기간·기산점으로 교체.
3. 상표(`demo-trademark-case-1`): 정답(correctOxValue) 자체가 없음 — 정답 확정 필요.
4. 지구과학(`demo-earth-diagram-1`): 판 경계 유형 정답과 이미지가 서로 모순되지
   않는지 재확인(이번 세션 중 이미지 방향 오류 1건을 발견해 수정함 — DECISIONS.md 참고).
