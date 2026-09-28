# 회독실 (hoedokshil)

변리사 1차시험(민법 · 산업재산권법 · 자연과학) 전과목 통합 학습 PWA.

> **이번 세션 범위: 단계 A(공통 엔진) 완료 + 단계 B(과목별 학습) 핵심 부분.**
> 서버 동기화/실제 푸시 알림(단계 D), 백업·오프라인 팩·실기기 검수(단계 E)는
> 아직 구현하지 않았다. 자세한 경계는 [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)를 보라.

## 최소 지원 환경

- Node.js 20+ (개발 시 Node 22로 검증)
- 최신 Chromium/Safari 계열 브라우저. iOS 16.4+ (Web Push를 쓰려면 필요 — 이번
  세션에는 Web Push 자체가 미구현이라 실기기 검증은 하지 않았다)
- 실기기 iPhone 검증은 하지 않았다. Chromium 자동화(390px 뷰포트)만 확인했다.

## 설치 · 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

## 빌드 · 미리보기

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm test           # vitest run — 도메인 엔진 + IndexedDB 리포지토리 단위 테스트
npm run test:watch
npm run typecheck
```

현재 50개 단위 테스트가 통과한다. 상세 범위는 [`docs/QA_REPORT.md`](docs/QA_REPORT.md).

## 무엇이 실제로 동작하는가

- **저장/복습 엔진**: 답을 제출하면 IndexedDB 트랜잭션 하나로 풀이 이벤트 저장 +
  복습 상태 재계산이 함께 일어난다(19.1). 앱을 새로고침해도 다음 복습일이
  유지된다.
- **과목별 차별화**: 민법류 항목은 O/X/모름 → 확신도 → 제출 흐름, 자연과학
  `independent_problem` 항목은 답 입력 → 힌트(선택) → 정답 확인 → 자기보고
  (혼자 풀었음/힌트 사용/풀이 열람/못 풂) 흐름으로 **서로 다른 숙달 판정
  규칙**이 실제로 적용된다. '학습' 탭에서 직접 확인할 수 있다.
- **오늘의 퀘스트**: 가용 시간(10/20/40분)과 현재 상황(짧게 읽기·OX/집중 풀이/
  듣기)에 따라 후보가 달라진다. 예: "집중 풀이"에서만 자연과학 독립 풀이
  문제가 배정되고, 후보가 없는 대분류의 시간 예산은 다른 대분류로 재배분된다.
- **10분 블록(기록 탭)**: 시간당 6칸 그리드를 탭해 실제 학습 블록을 수동으로
  표시할 수 있다(자동 시간 측정은 아직 없음).
- **리더(서재 탭)**: 민법·특허·물리 각 1개 문단이 관련 학습 항목과 양방향으로
  연결되어 있다. 문단에서 연결된 문제로, 문제 결과 화면에서 "근거 문단
  보기"로 서로 이동할 수 있고, 문단별 오답/미확인 항목 수를 실제 학습
  이력에서 계산해 보여준다(정확한 스크롤/입력 상태 복원까지는 안 됨).
- **콘텐츠 수입기(설정 탭)**: 패키지 폴더(`manifest.json` + `data/*.jsonl` +
  `assets/*`)를 통째로 선택하면 기존 콘텐츠와의 차이(신규/변경없음/새
  학습버전/충돌)를 미리 보여주고, 승인해야만 반영한다. 학습 이력
  (`attemptEvents`/`reviewStates`)은 트랜잭션에 store 자체가 포함되지 않아
  구조적으로 건드릴 수 없다. 이미지(webp/png/jpg) 등 바이너리 자산도
  가져올 수 있다.
- **시험문항 도메인 계층**(`src/domain/exam/`): 실제 기출처럼 공식 정답이
  없는 콘텐츠를 위한 계층이다. 선지별 판단(`AnalysisUnit`), 근거 문단
  연결(`EvidenceLink`), 해설 출처 구분(`ExplanationSegment` — AI 추론/제공
  해설/기본서 회수 중 무엇인지)을 다루며, 공식 정답이 없는 항목은 항상
  `verification: 'unverified'`로 남아 채점 보류·복습 일정 미반영을 유지한다.
- 앱이 기본으로 시딩하는 콘텐츠는 여전히 **테스트용 가상 자료**다. 실제
  변리사 1차시험 자연과학 기출 샘플 4문항(`astra-import/tools/
  convert_astra_samples.py`)과 민법 기출 공식 샘플 2문항(`civil-import/
  tools/convert_civil_samples.py`)을 위 수입기로 실제 가져와 화면까지
  렌더링되는 것은 확인했지만, 그 결과물 자체(실제 원문·해설)는 이
  저장소에 포함하지 않았다 — 통합 현황은
  `docs/DECISIONS.md`·`docs/KNOWN_LIMITATIONS.md`를 본다.

## 프로젝트 구조

```text
src/
  app/            앱 셸, 탭 라우팅, 세션/설정
  domain/         날짜·채점·복습·퀘스트·시간집계 순수 로직 (프레임워크 비의존)
  data/
    indexeddb/    IndexedDB 스키마·연결
    repositories/ 저장소 계층(원자적 쓰기 포함)
    fixtures/     테스트용 가상 데이터
  features/       화면별 UI (오늘/학습/서재/기록/설정)
tests/unit/       vitest 단위 테스트
docs/             감사·의사결정·배포·QA·한계 문서
scripts/          플레이스홀더 아이콘 생성 스크립트
astra-import/     자연과학 실제 기출 패키지 -> content-package 포맷 변환기(코드만, 실제 콘텐츠는 미포함)
civil-import/     민법 실제 기출 패키지 -> content-package 포맷 변환기(코드만, 실제 콘텐츠는 미포함)
```

## 콘텐츠 패키지

`content-package/`에는 앱의 데모 콘텐츠(민법·산재·자연과학 14개 학습 항목,
문단, 기간 카드, 그림·수식 자산)를 앱 도메인 타입과 1:1로 맞춘 JSON/JSONL
패키지가 있다. 재분석 없이 그대로 가져올 수 있게 만든 것이며, 자세한 내용은
[`content-package/README_FOR_CLAUDE.md`](content-package/README_FOR_CLAUDE.md)를
본다. 요약:

```bash
node --experimental-strip-types content-package/tools/build-package.mjs  # fixtures -> JSONL + manifest
node content-package/tools/validate-package.mjs                         # 기계 검증 (현재 오류 0건)
node content-package/tools/generate-review-queue.mjs                    # 미검증 항목 목록 갱신
```

앱의 설정 탭 → "콘텐츠 패키지 가져오기"에서 이 패키지의 `manifest.json` +
`data/*.jsonl` + `assets/*` 파일을 한 번에 선택하면, 기존 콘텐츠와 무엇이
다른지 미리 보여준 뒤 승인 시에만 반영한다(학습 기록은 절대 건드리지 않음 —
`content-package/IMPORT_RULES.md`).

## 문서 목차

- [`docs/IMPLEMENTATION_AUDIT.md`](docs/IMPLEMENTATION_AUDIT.md) — 시작 시점 저장소 상태(빈 저장소였음)
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — 문서 기본값에서 달라진 결정과 이유
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — 정적 배포 방법 + 서버 연동 절차(설정 대기)
- [`docs/DATA_MIGRATION_REPORT.md`](docs/DATA_MIGRATION_REPORT.md) — 스키마 초기 생성 기록(기존 데이터 없었음)
- [`docs/QA_REPORT.md`](docs/QA_REPORT.md) — 자동 검사/스모크 테스트 결과, 실기기 미검증 항목
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — 단계 A~E 대비 진행 상황과 빠진 것

## 라이선스/데이터 주의

모든 학습 콘텐츠는 합성 테스트 데이터이며 실제 시험 문제가 아니다. 이 저장소에는
개인 원문, 비밀키, 실제 사용자 데이터가 포함되어 있지 않다(`.env.example` 참고).
