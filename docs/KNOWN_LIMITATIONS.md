# KNOWN_LIMITATIONS.md

이 문서는 브리핑 24장(구현 순서와 완료 게이트) 기준으로 **무엇이 끝났고 무엇이
남았는지**를 정직하게 기록한다. "완료"라고 쓰지 않은 항목은 완료가 아니다.

## 단계별 상태

| 단계 | 상태 | 비고 |
|---|---|---|
| A. 공통 엔진 | 구현·테스트 완료 | 날짜/채점/복습 엔진 46개 단위 테스트 통과 |
| B. 과목별 학습 경험 | **부분 구현** | 9개 과목 각 1~2개 데모 항목의 흐름만 구현(자연과학 4문항은 실제 기출 샘플로 대체). 콘텐츠 수입기(20장) + 바이너리 자산 + 시험문항 도메인 계층까지 완료. 민법 680문항은 배치 변환·도메인 검증까지 완료(자산 포함, Chromium UI 재현은 미실시), 자연과학 720문항 전체 배치 변환은 미착수 |
| C. 오늘의 퀘스트/10분 블록 | **최소 구현** | 핵심 배분 로직은 있으나 기아 방지·정확한 시간 예측 등은 없음 |
| D. 서버 동기화·실제 알림 | **미구현** | 자격 증명(Supabase, VAPID) 없음. "설정 대기" |
| E. 백업/오프라인 팩/실기기 검수 | **미구현** | 다음 세션 과제 |

## 구체적으로 빠진 것

### 콘텐츠/데이터
- 실제 기출·조문·판례·기본서 데이터가 전혀 없다. 모든 콘텐츠는
  `src/data/fixtures/demoContent.ts`의 **테스트용 가상 자료** 14개 항목뿐이다
  (`content-package/`는 이 fixtures를 그대로 내보낸 것이지 새 데이터가 아니다).
- `ContentLink`/`TextbookParagraph`는 구현했다(9장 리더). `Question`/`Option`/
  `Topic`/`Concept`/`StatuteVersion`/`CaseRecord`/`ContentPack`/`SourceAsset`
  등 18.2절의 나머지 엔터티는 여전히 타입/저장소 모두 없다.
  `content-package/schema/source-asset.schema.json`,
  `schema/choice-option.schema.json`은 패키지 쪽 스키마만 먼저 정의해 둔
  것이고, **앱 IndexedDB에는 대응 store가 아직 없다.**
- **콘텐츠 패키지(`content-package/`)와 그것을 읽어들이는 수입기 둘 다 이제 있다.**
  `src/domain/import/`(파싱·기계 검증·diff)와 `src/data/repositories/importRepository.ts`
  (dry-run + 원자적 적용), 설정 탭의 "콘텐츠 패키지 가져오기" UI까지 구현했고,
  실제 `content-package/`의 11개 파일을 Chromium으로 실제 가져와 적용까지
  확인했다. IndexedDB에 `sourceAssets`/`choiceOptions`/`contentPackImports`
  store를 추가했다(v3 마이그레이션).
  - **바이너리 자산(webp/png/jpg)을 이제 지원한다**(`SourceAsset.binaryContent:
    Blob | null`). 파일 선택도 `<input type=file webkitdirectory multiple>`로
    바꿔 패키지 루트 기준 **전체 상대경로**로 자산을 매칭한다(과목 폴더별로
    같은 파일명이 겹치는 실제 기출 콘텐츠에서 이 문제를 실제로 발견해
    고쳤다 — `docs/DECISIONS.md`의 "실전 콘텐츠 통합" 절 참고). 폴더 선택을
    지원하지 않는 환경에서 개별 파일만 선택하면 여전히 basename으로
    대체되므로, 그 경우엔 동일 파일명 충돌 문제가 남는다.
  - **여전히 없는 것**: manifest의 sha256 해시 검증(패키지 무결성 확인 —
    content-package 쪽 validate-package.mjs에는 있지만 앱 쪽 수입기에는 아직
    포팅하지 않음), ZIP 압축 해제(사용자가 압축을 풀어 폴더째 선택해야 함),
    "패키지에서 빠진 기존 항목"을 실제로 `removed_upstream` 같은 상태로
    표시하는 기능(지금은 목록만 보여줌), object URL의 명시적 revoke(SPA
    화면 전환마다 새로 만들 뿐 정리하지 않는다 — 장시간 세션에서 메모리
    누적 가능).

### 실전 콘텐츠 통합(자연과학 Astra 패키지, 이번 세션 세 번째 증분)
- 사용자가 실제 변리사 1차시험 자연과학 기출(2009~2026, 720문항 규모) +
  실제 기본서 본문 + "제공 해설"을 담은 전문 제작 패키지를 업로드했다.
  이번 세션에는 그중 **공식 샘플 4개 dossier(P001/C099/B001/E083)만
  변환·가져오기·화면 렌더링까지 실제로 검증**했다(Chromium으로 파싱 0오류,
  검증 0이슈, dry-run/적용/문단 이미지/문항 이미지/해설 출처 배지까지
  전부 확인).
- 이를 위해 `src/domain/exam/`에 `ExamQuestion`/`AnalysisUnit`/
  `EvidenceLink`/`ExplanationSegment`/`FormulaRecord` 등 병렬 도메인
  계층을 새로 만들고 IndexedDB v4로 대응 store 7개를 추가했다. 720문항
  전부가 `verification: 'unverified'`이므로(공식 정답이 없다) 이 항목들의
  풀이는 항상 "채점 보류"이고 복습 일정에도 영향을 주지 않는다 — 의도된
  동작이다.
- **720문항 전체를 우리 포맷으로 배치 변환하는 작업은 하지 않았다.**
  `astra-import/tools/convert_astra_samples.py`의 `SAMPLE_IDS` 목록만
  넓히면 로직 변경 없이 확장 가능하도록 만들어 뒀지만, 실행 자체와 그
  결과물(수백MB급 이미지 자산 포함)을 어디에 어떻게 보관할지는 다음
  세션 과제다.
- **실제 콘텐츠(변환 결과 JSONL, 이미지 등)는 이 저장소에 커밋하지
  않았다.** `licenseScope: "personal-exam-prep-restricted"`인 개인용
  제한 콘텐츠이고 이 저장소는 public이라, 코드(변환기 스크립트)만
  커밋했다 — `docs/DECISIONS.md` 참고. 사용자가 예고한 민법 패키지(2개
  파일)도 도착하면 같은 원칙(코드는 커밋, 실제 콘텐츠는 저장소 밖)을
  적용할 예정이다.
- 민법 패키지가 도착했을 때 지금의 exam 도메인 계층(선지별 판단·근거
  연결·해설 출처 구분)이 그대로 재사용 가능한지, 아니면 민법 특유의
  구조(조문 번호, 판례 인용 등)를 위한 추가 필드가 필요한지는 실제로
  받아보기 전까지는 확인할 수 없다.

### 민법 콘텐츠 통합(hoedoksil_civil_final_v1 패키지)
- 사용자가 실제 변리사 1차시험 민법(2010~2026, 680문항) + 58개 장 기본서
  완결본 패키지를 zip 2파트로 업로드했다. 첫 세션에는 패키지에 포함된
  공식 완결 샘플 2문항(2011-08, 2011-14)만 변환·가져오기·화면 렌더링까지
  실제로 검증했다(패키지 자체 검증기 68,618레코드 0오류 확인 후,
  Chromium으로 파싱 0오류·검증 0이슈, dry-run/적용/문단 열람/O·X 흐름/
  "채점 보류"/제공·AI 답 병기/해설 출처 배지(제공+AI 둘 다) 확인).
- **이후 세션에서 680문항 전체 배치 변환까지 구현·실행했다.**
  `civil-import/tools/convert_civil_samples.py`를 고쳐 패키지의
  `tools/read_question.py::render_question`을 문항마다 직접 호출하도록
  바꾸고(중간 `samples/*.complete.json` 산출물 없이 바로 소비), 성능을 위해
  `PackageReader`(문항당 `registry/entities.jsonl` 25MB 재인덱싱)를 공유
  인스턴스로 캐싱했다(680문항 처리 시간 20초 내외). `--all` 플래그로 전체
  680문항 → `learningItems=3306 examQuestions=680 analysisUnits=3306
  evidenceLinks=1962 explanationSegments=6612 hints=6612 sourceAssets=75`
  변환을 실제로 실행했다. 결과물은
  `parseContentPackage`/`validatePackage`(앱이 실제 수입 시 쓰는 바로 그
  코드)로 검증해 **parseErrors 0, validationIssues 0**을 확인했다 — 단,
  680문항 전체에 대해 Chromium으로 UI를 클릭해 가져오기까지 재현하지는
  않았다(2문항 때만 함).
- **160개 이미지 전용 문항(질문 자체가 텍스트 없이 스캔 이미지만 있는
  경우)을 이번에 실제로 처리하면서 기존 변환 로직의 버그를 하나 고쳤다.**
  이미지 전용 문항은 해설(`ExplanationSegment`)이 개별 `Statement`가 아니라
  `Question` 자체를 가리킨다(`targetEntityType: 'Question'`, 지문별 별도
  레코드가 없음). 기존 코드는 `targetEntityId`(=문항 id)를 그대로 분석
  단위 id로 써서, 한 문항에 지문이 여러 개면 서로 덮어써 마지막 지문만
  남았다 — 예를 들어 2010-01은 지문 5개가 있었는데 고치기 전에는 1개만
  남았을 것이다. explanation 자신의 id를 분석 단위 id로 쓰도록 고쳐
  지문마다 별도 학습 항목이 생기게 했다(680문항 실행 결과 이 경로로 생긴
  학습 항목 777개, 문항당 지문 수가 실제로 다 살아있음을 확인).
  스캔 페이지 이미지(75개 고유 파일, 11MB, 최대 3문항이 한 페이지 공유)도
  `source-assets.jsonl` + `assets/`로 이번에 처음 내보내
  `ExamQuestion.questionAssetId`/`LearningItem.requiredAssetIds`에
  연결했다(자연과학 패키지의 자산 처리 방식을 그대로 따름). 2페이지짜리
  문항 1건(2010-19)은 `questionAssetId`엔 첫 페이지만 담기고(도메인
  타입이 단일 값이라서) 두 페이지 다 `requiredAssetIds`에는 들어간다 —
  알려진 한계로 남긴다.
- **조문(base.statutes 647건)·판례(base.case_excerpts 48건)를 별도
  엔터티로 다루는 것, `exam.study_items`/`base.review_questions` 같은
  부가 컬렉션은 여전히 다루지 않았다.** `solution_steps`(680문항 전체
  기준 실제 건수 재확인 안 함, 첫 세션엔 4건)는 전용 엔터티를 새로 만들지
  않고 AI 해설 텍스트에 이어붙이는 방식 그대로 유지했다.
- **`ExamQuestion.currentLawAnswer`(현행법 재검토 답, 4번째 답 축)를
  스키마에 추가했지만 화면에 실제로 값이 나온 적은 없다** — 680문항 전부
  `status: 'not_reviewed'`라 미검토 상태라서다(전체 재확인함). 필드/렌더링
  코드는 있으니 값이 채워진 문항이 오면 추가 작업 없이 표시될 것으로
  기대하지만, 실제 검증은 하지 못했다.
- **`base/blocks.jsonl`의 문단이 소속된 장(chapter)/절(section)을 문단 id
  문자열 패턴(`{장}-{절}-B{번호}`)으로 역추정한다** — 패키지가 렌더링된
  문단 객체 자체에는 chapter_id/section_id를 별도로 내려주지 않아서다.
  두 샘플에서는 이 패턴이 100% 맞았지만, 예외적인 블록(표·부록 등)이
  섞이면 어긋날 수 있다.
- **민법 패키지의 참조 구현(`tools/import_content.py`)은 SQLite 대상이라
  우리 IndexedDB 수입기와 저장소가 다르다.** 같은 키(namespace/collection/
  entityId)·해시·원자성 원칙은 이미 우리 importRepository가 만족하지만,
  이 패키지 고유의 "이전 payload 해시+리비전까지 정확히 일치해야 갱신
  허용"(`registry/allowed_predecessors.jsonl`) 같은 더 엄격한 체인 검증은
  우리 쪽에 이식하지 않았다 — 지금은 민법 콘텐츠도 자연과학과 같은
  learningEpoch 기반 5분류 diff만 적용된다.
- **실제 콘텐츠(변환된 결과물 - 2문항이든 680문항 전체든, 원본 패키지, 스캔
  이미지 75개)는 이 저장소에 커밋하지 않았다.** 자연과학 패키지와 같은
  이유(`licenseScope: personal-exam-prep-restricted`, public 저장소) —
  `civil-import/tools/convert_civil_samples.py`(변환기 코드)만 커밋했다.
  680문항 전체 변환 결과물은 사용자에게 별도 파일로 전달했다.

### 리더(9장)
- **최소 구현 완료(이번 세션 두 번째 증분)**: 3개 과목(민법·특허·물리)에 대표
  문단 1개씩, `ContentLink`로 학습 항목과 양방향 연결, '서재' 탭에서 문단 목록
  → 문단 상세(연결/오답/미확인 수, 수동 형광펜 토글) → 연결 항목 열기, 그리고
  문제 결과 화면의 "근거 문단 보기" → 문단 화면까지 실제로 동작한다
  (`src/features/reader/renderParagraphView.ts`).
- **여전히 없는 것**: 문단 ID 기반 딥링크(URL 라우팅), 페이지가 아닌 문단
  단위 스크롤 위치 자동 보존, 사용자 글자 크기·줄간격·테마 조절, 원문 PDF
  보조 뷰어, 조문 전문/판례 원문 리더, TTS 청취 목록. 나머지 6개 과목에는
  문단이 없다(대표 예시 3개뿐).
- **정확한 상태 복원 없음(9.2 일부 미달)**: "이동 전 답안·스크롤·해설 열림
  상태를 유지한다"는 요구 중, 문제→문단 이동 후 "문제로 돌아가기"는 해당
  항목의 새 풀이 화면을 다시 여는 것이지, 방금 본 결과 화면이나 스크롤
  위치를 그대로 복원하는 것이 아니다.

### 서버/동기화/알림(14, 19장)
- `POST /api/sync/events` 등 18.4의 서버 API는 코드/스텁도 없다.
- `SyncOutbox`는 저장만 하고 실제 발송/재시도 로직이 없다.
- Web Push, VAPID, Supabase Cron 스케줄러는 전혀 구현하지 않았다. 알림 권한
  UX(14.4)도 없다.
- 다중 기기 충돌 해소(19.4)는 로컬 저장소 하나만 있는 현재 구조에서 테스트할
  방법이 없어 미검증이다.

### 퀘스트/플래너(12, 13장)
- 12.5의 "연속 3회 배정 제외 시 우선순위 승격"(기아 방지)은 이력 추적이 필요해
  구현하지 않았다.
- 12.4의 실제 유효 풀이시간 기반 시간 예측 보정은 없다(고정 초기값만 사용).
- 13.4의 자동 시간 측정(백그라운드/잠금 감지, 실제 재생 상태 기반 청취시간
  등)은 없다. '기록' 탭은 탭으로 수동 표시하는 수준까지만 구현했다.
- `TimeSegment`/`StudySession`의 실제 연동(문제 풀이 세션과 10분 블록의 자동
  연결)은 없다.

### 오프라인/업데이트/백업(21장)
- 단원별 다운로드 팩, 오프라인 준비 완료 판정은 없다.
- 백업/복원 기능(학습 기록 백업, 전체 백업, 복원 미리보기/병합)은 없다.
- 서비스 워커는 vite-plugin-pwa의 기본 precache만 사용한다. prompt 업데이트
  UI는 최소한으로 붙였으나 실기기에서 검증하지 않았다.

### 인증(19.6)
- 로컬 전용 모드만 있다. 로그인, 계정 연결, 로컬→계정 이벤트 마이그레이션은
  없다.

### 접근성/성능/실기기(23장)
- VoiceOver, 200% 확대, 모션 축소 설정 등은 개별 테스트하지 않았다.
- 5,000문제/25,000학습항목/50,000이벤트 규모의 성능 테스트를 하지 않았다(데모
  데이터는 15개 항목 수준).
- **실제 iPhone에서 검수한 적이 없다.** Chromium 기반 자동화 테스트(390px
  뷰포트)만 수행했다. 14.8절의 "완료 판정" 기준(실기기 설치→권한→알림→탭)은
  전혀 충족하지 못했다 — 애초에 알림 기능 자체가 없다.

### 채점 엔진(8.7)
- 수식 동치 판정 엔진이 없다(의도적 — "eval 등으로 흉내내지 않는다"는 규칙을
  지키기 위해 수식 입력 문제는 지원하지 않고, 수치/단위 비교만 지원한다).
- 클로즈(빈칸) 채점은 대소문자 무시 문자열 비교만 한다. 유의어/동의어 처리는
  없다.

## 다음 세션에서 우선순위로 제안하는 것

1. 자연과학 720문항·민법 680문항 전체를 각 변환기(`convert_astra_samples.py`/
   `convert_civil_samples.py`) 확장으로 배치 변환하고, 실제 콘텐츠(및
   대용량 이미지 자산)를 어디에 보관할지 결정한다(이 저장소는 public —
   `docs/DECISIONS.md` 참고).
2. 민법의 160개 이미지 전용 문항, 조문(statutes)·판례(case_excerpts) 전용
   엔터티화, `solution_steps`가 많아질 때 전용 타입 도입 여부를 확인한다.
3. `Question`/`Option`/`Topic`/`Concept`/`StatuteVersion`/`CaseRecord` 등
   나머지 18.2 엔터티 구현, 리더(9장)를 나머지 과목으로 확장.
4. 수입기에 manifest sha256 검증, ZIP 압축 해제, object URL revoke 추가.
5. Supabase 프로젝트가 준비되면 단계 D(동기화/알림) 착수.
