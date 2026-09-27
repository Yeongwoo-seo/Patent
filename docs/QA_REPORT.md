# QA_REPORT.md

0.4절 지시대로, **자동화 검사 통과와 실기기 검수를 구분**한다. 브라우저 에뮬레이션
통과를 실기기 완료로 표기하지 않는다.

## 1. 자동 검사 (이 세션에서 실제로 실행함)

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입체크 | `npm run typecheck` (`tsc --noEmit`) | 통과, 오류 0 |
| 단위 테스트 | `npm test` (`vitest run`) | **50/50 통과**, 7개 파일 |
| 프로덕션 빌드 | `npm run build` | 통과. JS 번들 gzip 약 15KB (초기 목표 250KB 이내, 23.1) |

### 단위 테스트 범위

- `tests/unit/domain/calendar.test.ts` — `computeStudyDay`/`addStudyDays`, 서머타임
  전환 구간(2026-10-04 Sydney DST) 포함 10개
- `tests/unit/domain/gradeAttempt.test.ts` — OX/객관식/수치/시퀀스 채점, 미검증
  스펙의 ungraded 처리, 빈 답안을 0으로 오채점하지 않는지 등 10개
- `tests/unit/domain/reduceReviewState.test.ts` — **11.7 고정 테스트 벡터**를
  포함해 상태 전이표 전체(첫 평가, 단계 상승, 단계4 상한, 최소 간격, 동일 학습일
  중복 상승 방지, 예정일 전 오답/정답, 확신도/도움 게이트, 독립 풀이 요건,
  ungraded 무변화) 13개
- `tests/unit/domain/buildDailyPlan.test.ts` — 대분류 균등 배분, 예산 재배분,
  컨텍스트 필터링, 약점 우선순위, 계획 안정성(12.6), 최소 목표(12.7) 6개
- `tests/unit/domain/timeTracking.test.ts` — 중복 구간 합집합 계산(13.4) 3개
- `tests/unit/domain/paragraphStats.test.ts` — 문단 통계 계산(9.2), 미시도/‘new’
  상태를 미확인으로 정확히 분류하는지, 관계없는 항목의 통계를 끌어오지 않는지 4개
- `tests/unit/data/attemptRepository.test.ts` — IndexedDB 트랜잭션 원자성(19.1),
  미검증 스펙의 무변화, 노출 이벤트의 최소 간격 반영 4개 (fake-indexeddb 사용)

## 2. 수동/자동화 브라우저 스모크 테스트 (Chromium, 이 세션에서 실행함)

이 환경에는 실제 iPhone이 없다. 대신 Playwright + 사전 설치된 Chromium으로
390×844(iPhone 12/13 크기) 뷰포트에서 프로덕션 빌드(`vite preview`)를 띄워
다음을 확인했다.

- [x] 앱 로드, 콘솔 오류/미처리 예외/4xx 응답 없음
- [x] 하단 탭 5개 렌더링, 탭 전환 정상
- [x] **민법 OX 흐름**: 선지 제시 → O/X/모름 → 확실/애매 → 제출 → 결과 표시.
      해당 데모 항목은 `verification: 'unverified'`라 `ungraded`로 정확히
      처리되고 복습 일정에 반영되지 않음을 확인(7.3/4.3 의도된 동작)
- [x] **물리 독립 풀이 흐름**: 답 입력 → 힌트(선택) → 정답 확인 → 자기보고
      ("혼자 풀었음") → `correct` 판정 → `ReviewState.dueStudyDay`가 다음
      학습일로 설정됨을 IndexedDB에서 직접 조회해 확인
- [x] 오늘의 퀘스트: 컨텍스트를 "집중 풀이"로 바꾸면 물리/화학/생물의
      `independent_problem` 항목만, "짧게 읽기·OX"로 바꾸면 개념/공식 회상
      항목만 후보가 됨을 확인(12.3-3 반영)
- [x] 기록 탭: 10분 그리드 셀 탭 → `plannerBlocks`에 저장/삭제 토글 확인
- [x] 설정 탭 렌더링 확인
- [x] **리더 왕복(9.2)**: 서재 탭 → 문단 카드(연결/오답/미확인 수 표시) → 문단
      상세 → 형광펜 토글(on 확인) → 연결된 학습 항목 열기 → OX 풀이 제출 →
      결과 화면의 "근거 문단 보기" 버튼 → 원래 문단으로 복귀까지 오류 없이 확인

이 목록은 **자동화 스모크 테스트**이며 다음을 검증하지 않는다: 실제 iPhone
Safari/홈 화면 설치 동작, 안전 영역 inset의 실기기 렌더링, 소프트 키보드 겹침,
VoiceOver, 실제 Web Push 수신(14.8 완료 판정 기준 미충족).

## 3. 미실행 항목과 사유

| 항목 | 사유 |
|---|---|
| 실기기(iPhone) 검수 전반(23.2) | 이 환경에 실기기 없음 |
| Web Push 실발송(14.8) | 서버/VAPID 자격 증명 없음 — `docs/DEPLOYMENT.md` 참고 |
| 5,000문항/25,000항목/50,000이벤트 성능 테스트(23.1) | 이번 세션 범위 밖(단계 E) |
| VoiceOver/200% 확대/모션 축소 개별 검증(16.2) | 실기기·스크린리더 도구 없음 |
| 다중 기기 동기화 충돌(19.4) | 서버 미구현으로 재현 환경 없음 |
| E2E(Playwright) 스위트를 저장소에 커밋 | 이번 세션엔 1회성 수동 스크립트로만 실행, 회귀 스위트로 정식 추가하지 않음(다음 세션 과제) |

## 4. 알려진 버그/이상 (발견 즉시 수정한 것 포함)

- (수정됨) `gradeAttempt`의 수치 채점이 빈 문자열(`''`)을 `Number('')===0`으로
  오인해 정답 처리할 뻔한 문제 — 빈 답안은 `unknown`으로 명시 처리하도록 수정,
  회귀 테스트 추가.
- (수정됨) DOM 헬퍼에서 `style` 문자열을 `Object.assign`으로 직접 대입하면
  strict mode에서 `TypeError`가 발생하는 문제 — `style.cssText` 대입으로 수정.
- (수정됨) 데모 데이터의 `LearningItem.verification`이 전부 `'unverified'`로
  설정되어 있어 검증된 과학 항목까지 "오늘의 퀘스트" 후보에서 빠지던 문제 —
  물리/화학/생물 6개 항목만 실제 채점 스펙과 일치하게 `'verified'`로 수정.
