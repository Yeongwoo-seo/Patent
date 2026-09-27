# IMPLEMENTATION_AUDIT.md

이 문서는 `hoedokshil_development_brief.txt`(v1.0, 2026-09-28) 0.2절 지시에 따라
**작업 시작 시점에 저장소에서 실제로 발견한 것**만 기록한다. 추정이나 과거 산출물의
존재를 가정하지 않는다.

## 1. 조사 결과

작업 시작 시점(2026-09-27, 이 저장소의 `claude/new-session-v5x2tq` 브랜치 기준)에
저장소는 다음 상태였다.

- `git log`: 커밋 0개 (`your current branch ... does not have any commits yet`)
- 파일: 없음 (`.git/`만 존재)
- `CLAUDE.md`, `AGENTS.md`, `README.md`, `package.json`, lockfile: 없음
- 기존 UI/HTML 자산, 서비스 워커, DB, 백업 포맷, 실제 콘텐츠 파일: 없음
- 기존 문제 ID, 문단 ID, 학습 기록: 없음

즉 이 프로젝트는 브리핑 0.2절이 예상한 "기존 프로젝트 점검" 시나리오가 아니라,
17.1절이 언급한 **"새 프로젝트"** 경로에 해당한다. 따라서 기존 자산을 보존하는
작업은 발생하지 않았고, 모든 코드는 이번 세션에서 새로 작성했다.

## 2. 이번 세션에서 만든 것 (요약)

상세 내용은 저장소 루트 `README.md`와 `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`를 참고한다.

- Vite + TypeScript + vite-plugin-pwa + vitest 기반 신규 프로젝트 스캐폴딩
- 공통 도메인 엔진: `computeStudyDay`/`addStudyDays`(11.3), `gradeAttempt`(8.7),
  `reduceReviewState`(11.5~11.6, 11.7 고정 테스트 벡터 포함)
- IndexedDB 저장소: `AttemptEvent` append-only 기록 + `ReviewState` 파생 투영을
  단일 트랜잭션으로 처리(19.1), `ExposureEvent`, `SyncOutbox` 스텁
- 아홉 세부 과목의 **테스트용 가상 데이터**(`isSynthetic: true`, "테스트용 가상 자료" 표시)
- 오늘의 퀘스트 생성기(`buildDailyPlan`)의 최소 구현(12.3, 12.4, 12.7 일부)
- 최소 UI: 오늘/학습/서재/기록/설정 다섯 탭, 민법 OX 흐름과 자연과학 독립 풀이 흐름의
  실제 차별화된 구현
- 단위 테스트 46개 (도메인 엔진 + IndexedDB 리포지토리), 전체 통과

## 3. 이번 세션에서 하지 않은 것

- 실제 기출/조문/판례/기본서 데이터 수입 — 실 데이터 파일을 전달받지 않았으므로
  수입 어댑터의 "형태"만 다음 세션 과제로 남겨두었다(20장은 미착수).
- 서버(Supabase Auth/Postgres/Cron), Web Push 발송 — 자격 증명이 없으므로 서버
  코드/설정 안내는 작성하지 않았고 `docs/DEPLOYMENT.md`에 "설정 대기"로 표시했다.
- 실기기(iPhone) 검수 — 이 환경에는 실기기가 없다. Chromium 기반 자동화 스모크
  테스트만 수행했다(`docs/QA_REPORT.md` 참고).

## 4. 보존 정책

기존 데이터/ID가 없으므로 이번 세션에는 "보존해야 할 기존 기록"이 없다. 다음
세션부터 실 데이터가 들어오면, 본 문서의 이 절을 갱신해 **그 시점에 실제로
발견한 파일/스키마**를 기록해야 한다(0.2절 지시 반복 적용).
