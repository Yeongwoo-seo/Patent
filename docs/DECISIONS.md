# DECISIONS.md

브리핑 문서의 기본값에서 달라졌거나, 문서가 명시하지 않아 이번 세션에서 임의로
정한 사항과 그 이유를 기록한다.

## 범위 결정

- **이번 세션 범위 = 단계 A + 단계 B 핵심.** 사용자에게 직접 확인한 결정이다
  (24장의 단계 A~E 중, 저장소가 완전히 비어 있어 신규 프로젝트로 시작하는 상황을
  설명하고 범위를 물었다). 단계 C(퀘스트/10분 블록)는 최소 구현까지 포함했지만,
  단계 D(서버 동기화/실제 푸시)와 단계 E(오프라인 팩 다운로드/백업 복원/실기기
  검수)는 손대지 않았다. 0.4절의 "완료를 과장하지 말 것"에 따라 README와 각 보고서에
  이 경계를 명시했다.

## 기술 스택

- **Vite + TypeScript(vanilla) + idb + vite-plugin-pwa + vitest.** 17.1절이 "새
  프로젝트라면 Vite + TypeScript + 가벼운 모듈 구조를 기본으로 한다"고 명시했고,
  기존 자산이 전혀 없었으므로 그대로 따랐다. React 등 프레임워크나 대형 상태관리
  도구는 도입하지 않았다(17.1 "PWA라는 이유만으로 Next.js나 대형 상태관리 도구를
  의무화하지 않는다").
- UI는 프레임워크 없이 DOM API로 직접 구성했다. 화면 수가 아직 적고(5개 탭),
  가상 DOM 도입 비용보다 단순성이 우선이라고 판단했다(17.1, 구현 단순성 우선순위).

## 도메인 엔진

- **복습 정책 버전 `2026.09.28-initial`**: 11.1의 초기 간격(1/3/7/14/30일)과
  11.4의 최소 간격(8시간)을 정책 데이터 객체(`ReviewPolicy`)로 분리해, 향후
  과목별/항목유형별로 다른 정책을 주입할 수 있게 했다. 지금은 모든 항목이 같은
  정책을 쓴다 — 과목별 정책 분기는 이번 세션 범위 밖이다.
- **"애매" 처리의 조기(예정일 전) 확장 해석**: 11.5의 "예정일 전의 오답·애매"는
  표현상 확신도(애매)를 말하지만, 표에 없는 "예정일 전에 정답이지만 애매/힌트
  사용"의 취급을 문서가 명시하지 않는다. 11.5의 일반 규칙("정답이나 애매·추측·
  힌트 사용 → 단계 0")과 11.6의 보수적 기본값 원칙을 그대로 확장 적용해, 예정일
  전이라도 확신 없는 정답/힌트 사용/비독립 풀이는 "실패류"로 취급해 예정일을
  앞당기도록 구현했다(`reduceReviewState.ts` 주석 참고). 반대로 예정일 전의
  "정답+확실+무도움+(필요시)독립풀이"만 조기 연습으로 인정해 아무것도 바꾸지
  않는다. 이 해석은 문서에 명시적 예시가 없으므로 정책 버전을 올리면 재검토가
  필요하다.
- **최소 간격의 기준 시각**: "직전 동일 답 노출·유효 평가 후 최소 간격"(11.4-6)을
  `max(lastAdvancedAtUtc, lastAnswerExposureAtUtc)` 기준으로 구현했다. 즉 정답
  노출(해설 열람)과 마지막 유효 상승 중 더 최근 시각을 기준으로 삼는다.

## 데이터/과목 검증 상태

- **`LearningItem.verification`이 `'verified'`인 항목만 자동 채점 퀘스트(오늘의
  퀘스트) 후보로 삼는다**(12.3-2, 7.3 반영). 이번 데모 데이터에서는 물리·화학·
  생물의 6개 항목만 `'verified'`이고, 민법·특허·실용신안·상표·디자인·지구과학
  항목은 `'unverified'`/`'needs_review'`다 — 실제 법률/과학 정오를 검증한 적이
  없기 때문이다(0.2절 "과거 산출물의... 검증 완료 여부를 사실로 가정하지 말 것").
  이 항목들은 **'학습' 탭에서는 계속 열람·시도할 수 있고**, 시도는 기록되지만
  `outcome: 'ungraded'`로 남아 복습 일정에 반영되지 않는다. 이는 버그가 아니라
  7.3/4.3의 의도된 동작이다.
- **가상 선택지 텍스트(`demoChoiceOptions`)**: `GradingSpec`에는 정답 ID만
  저장하고, 사용자에게 보여줄 선택지 레이블은 별도 데모 전용 맵으로 분리했다.
  실제 데이터 수입 시에는 `Question`/`Option` 엔터티(18.2)로 대체해야 한다 —
  이번 세션에는 그 엔터티들을 구현하지 않았다(KNOWN_LIMITATIONS 참고).

## 시간대/설정 기본값

- 초기 시간대 `Australia/Sydney`, 하루 경계 `00:00`은 11.3절의 제안값을 그대로
  사용했다. 설정 화면에서 `Australia/Sydney`/`Asia/Seoul`/`UTC` 중 선택할 수
  있게 했다(실제 서비스에서는 IANA 전체 목록을 지원해야 하지만, 이번 세션에는
  대표 시간대 3개만 넣었다).
- 대분류 시간 가중치 초기값은 민법:산재:자연과학 = 1:1:1(12.4)로 설정하고
  설정 화면에서 숫자로 조정 가능하게 했다.

## 리더(9장) 최소 구현 관련 결정

- **IndexedDB 스키마를 v1→v2로 버전업**하면서 기존 store는 그대로 두고
  `textbookParagraphs`/`contentLinks`/`annotations` 3개 store만 추가했다
  (`upgrade(db, oldVersion)`에서 `oldVersion < 1`/`< 2` 분기). 21.2절 "서비스
  워커/앱 갱신을 이유로 학습 DB를 삭제하지 않는다"를 실제로 지키는 첫 사례로
  삼았다 — 이후 스키마 변경도 이 패턴(oldVersion 분기 누적)을 따라야 한다.
- **`ContentLink`의 방향을 UI에서 대칭으로 취급**한다. 저장은 `fromId`(학습
  항목)→`toId`(문단) 한 방향으로만 하되, 조회 함수(`getLinkedParagraphIdsForItem`
  / `getLinkedItemIdsForParagraph`)는 `byFrom`/`byTo` 두 인덱스를 모두 조회해
  "반대편 id"를 반환한다. 문서 9.2가 "문제→문단, 문단→문제" 양방향 이동을
  요구하지만 매번 두 방향 레코드를 중복 저장하고 싶지 않았기 때문이다.
- **실제 기출 연도 배지는 만들지 않았다.** 9.2가 요구하는 배지 중 "실제로
  연결된 기출 연도"는 합성 데이터에 그런 메타데이터가 없어 표시할 근거가
  없다(4.1 "근거 없는 빈출 배지는 생성하지 않는다"). 대신 실제로 계산 가능한
  두 수치(오답 이력 있는 연결 항목 수, 미확인 항목 수)만 `computeParagraphStats`로
  구현했다.
- **문제→문단→"문제로 돌아가기"는 상태를 완전히 복원하지 않는다.** 정확한
  스크롤/입력 상태 보존(9.2)은 라우터·세션 스냅샷이 필요한 더 큰 작업이라
  이번 세션엔 손대지 않았고, "돌아가기"는 해당 항목의 새 풀이 화면을 다시
  여는 것으로 단순화했다. `docs/KNOWN_LIMITATIONS.md`에 명시했다.
- **문단 3개(민법·특허·물리)만 대표로 만들었다.** 아홉 과목 전부에 문단을
  만드는 것은 실제 기본서 원문이 없는 상태에서 데모 데이터를 과도하게
  부풀리는 것이라 판단해, 리더 UI/도메인 로직이 실제로 동작함을 보여주는
  최소 표본만 두었다.

## 콘텐츠 패키지(`content-package/`) 관련 결정

- **앱 소스(`src/data/fixtures/demoContent.ts`)를 단일 소스로 삼아 패키지를
  생성한다.** `content-package/tools/build-package.mjs`가 그 파일을 직접
  import해 `data/*.jsonl`과 `manifest.json`을 생성한다 — 패키지 안에 데이터를
  손으로 다시 옮겨 적지 않는다. 앱과 패키지가 따로 노는(drift) 것을 막기
  위함이다.
- **런타임 의존 패키지를 0으로 유지**했다. JSON Schema 검증도 ajv 없이
  `content-package/tools/mini-schema.mjs`라는 draft-07 부분집합 검증기를
  직접 작성했다. 이 패키지를 "가져오는 쪽"이 무엇을 신뢰해야 하는지 감사하기
  쉽게 하기 위해서다(README_FOR_CLAUDE.md에 명시).
- **Node 22의 `--experimental-strip-types`로 `.ts` 소스를 직접 import**한다
  (`build-package.mjs` 실행 시에만 필요). 새 의존성(`tsx`, `ts-node`)을 추가하지
  않기 위한 선택이다. `validate-package.mjs`는 순수 JS라 이 플래그가 필요 없다.
- **자산(그림·수식)을 실제로 만들어 넣었다.** 이전 세션까지 상표/지구과학
  항목은 "자산 누락됨"으로 표시돼 있었다. 이번에 플레이스홀더 SVG 2개와 물리
  공식 자산(JSON, latex+TTS 문장) 1개를 실제로 만들어 `requiredAssetIds`가
  전부 해소되게 했다(`demoContent.ts`의 물리 두 항목에 자산 참조 추가).
- **콘텐츠 의미 검수 중 실제 오류 1건을 발견해 수정**: 지구과학 판 경계
  그림(`demo-asset-earth-plate-map-1.svg`)의 화살표를 처음에는 서로를 향하게
  (수렴 경계) 그렸는데, 채점 기준(`demo-earth-diagram-1-spec`)의 정답은
  `opt-divergent`(발산 경계)였다. 기계 검증으로는 잡을 수 없는 종류의 문제라
  직접 확인하다 발견해 화살표 방향을 발산으로 고쳤다. `VALIDATION_REPORT.md`가
  "콘텐츠 의미 검수는 기계가 못 한다"고 명시한 바로 그 사례다.
- **선택형 문항의 정답 ID ↔ 실제 선택지 텍스트 일치 여부를 검증기에 추가**했다.
  이전 세션에서 앱 UI를 만들 때 정답 집합과 화면에 보여줄 선택지 목록을 서로
  다른 곳(`GradingSpec.correctOptionIds` vs `demoChoiceOptions`)에 저장한
  구조적 위험이 있다는 것을 알게 되어, `validate-package.mjs`가
  `invalid_correct_option`/`missing_choice_options`로 이를 기계적으로 잡게
  했다.
- **SourceAsset/Question·Option 같은 정식 엔터티는 앱 도메인 타입에 아직
  없다.** 패키지의 스키마(`schema/source-asset.schema.json`,
  `schema/choice-option.schema.json`)는 미래의 수입기 구현을 염두에 두고
  먼저 정의한 것이며, 앱의 IndexedDB에는 대응 store가 아직 없다 —
  `docs/KNOWN_LIMITATIONS.md`에 명시했다.

## 수입기(20장) 관련 결정

- **learningEpoch 인지 diff는 LearningItem에만 적용한다.** `GradingSpec`,
  `DurationRule`, `TextbookParagraph`, `ContentLink`, `SourceAsset`,
  `ChoiceOptionSet`은 `learningEpoch` 개념이 없고 `ReviewState`와 직접
  키로 엮여 있지도 않다(LearningItem을 통해서만 간접 영향) — 그래서 이들은
  단순 "새 id/내용 동일/내용 다름" 3분류(`diffById`)만 쓰고, 학습 이력
  보호가 실제로 걸려 있는 LearningItem만 5분류(`diffLearningItems`)를 쓴다.
- **(수정됨 — 아래 "실전 콘텐츠 통합" 절 참고) 파일 선택은 `<input type=file
  webkitdirectory multiple>` + 패키지 루트 기준 상대경로 매칭**으로 바꿨다.
  원래는 `<input type=file multiple>` + basename 매칭이었는데, 실제 기출
  콘텐츠에서 서로 다른 과목 폴더에 같은 파일명(`0006.webp`)이 겹치는 사례를
  발견해 더 이상 안전하지 않다고 판단했다. `webkitdirectory`는 Playwright
  `setInputFiles(dirPath)`로도 문제없이 자동화 테스트가 가능함을 실제로
  확인했다(우려했던 자동화 안정성 문제는 없었다). 폴더 선택을 지원하지 않는
  환경(구형 브라우저 등)에서는 `file.webkitRelativePath`가 비어 있어
  basename으로 대체되므로, 그 경우엔 여전히 동일 파일명 충돌 위험이
  남는다 — KNOWN_LIMITATIONS.md에 명시.
- **ZIP 압축 해제는 구현하지 않았다.** 브라우저에서 zip을 풀려면 라이브러리가
  필요한데(예: fflate), 이번 세션은 "의존 패키지 최소화"를 우선했다. 사용자가
  압축을 풀어 파일들을 직접 선택해야 한다.
- **manifest.json의 sha256 해시는 검증하지 않는다(앱 쪽에서는).**
  `content-package/tools/validate-package.mjs`는 만드는 쪽에서 해시를
  검증하고, 앱 쪽 수입기는 "지금 가진 파일들이 서로 참조 무결적인지"만
  본다. 패키지 전송 중 변조 여부까지 잡으려면 WebCrypto `SubtleCrypto.digest`로
  재해싱하는 코드를 추가해야 한다(다음 세션 과제로 KNOWN_LIMITATIONS.md에
  기재).
- **epoch_conflict는 조용히 건너뛴다(에러로 막지 않음).** 전체 dry-run을
  막을 정도로 심각하진 않지만(다른 항목은 정상 반영돼야 하므로), 해당
  항목만 "적용 안 함"으로 남기고 UI에 개수를 보여준다. `canApply`는
  파싱/참조무결성 오류에만 반응하고 epoch_conflict 자체로는 false가 되지
  않는다 — 이 충돌은 "일부 항목만 보류"이지 "패키지 전체가 깨짐"이 아니기
  때문이다.

## 실전 콘텐츠 통합(자연과학 Astra 패키지) 관련 결정

- **실제 콘텐츠(720문항 규모, 실제 변리사 1차 자연과학 기출 2009~2026 + 실제
  기본서 본문 + "제공 해설")를 사용자가 8개 zip 파트로 업로드**했다. 무결성은
  패키지 자체 내장 검증기(`validate_final.py`, jsonschema+Pillow 기반)를
  직접 읽고 실행해 확인했다(0 errors / 45 datasets / 55,402 records /
  280,731 참조 검사 / 2,284개 이미지 디코딩 통과). 실행 전 4개 파이썬
  스크립트 전문을 읽어 네트워크 호출·파괴적 동작·경로 이스케이프 취약점이
  없음을 확인했다.
- **스키마를 패키지 수준으로 확장하기로 했다(사용자 명시적 선택)**. 원본
  패키지는 39개 필드짜리 문항, 선지별 판단 단위, 문자 단위 근거 스팬, 공식
  정답/제공 해설 정답/AI 추정 정답의 3중 구분 등 우리 앱의 LearningItem/
  GradingSpec보다 훨씬 세밀하다. 얕게 우리 스키마에 욱여넣는 대신
  `src/domain/exam/types.ts`에 병렬 도메인 계층(`ExamQuestion`/
  `AnalysisUnit`/`EvidenceLink`/`ExplanationSegment`/`FormulaRecord` 등)을
  새로 만들었다. LearningItem/GradingSpec은 여전히 복습 엔진이 보는 단순
  계약으로 남기고(`AnalysisUnit.id === LearningItem.id`로 연결), 리치한
  정보는 화면 표시 전용으로 exam 계층에서 가져온다 — 기존 OX 흐름·채점
  엔진·"근거 문단 보기" UI를 거의 그대로 재사용할 수 있었다.
- **공식 정답이 전혀 없다(720문항 전부).** 그래서 변환기는 모든
  `LearningItem.verification`을 예외 없이 `'unverified'`로 만든다 — 실제
  풀이는 채점되지 않고("채점 보류") 복습 일정에도 반영되지 않는다. 제공
  해설 답과 AI 추정 답은 화면에 "둘 다 공식 정답 아님"이라고 명시하며
  나란히 보여줄 뿐, 절대 공식 정답으로 취급하지 않는다.
- **바이너리 자산(webp/png/jpg)을 이제 지원한다.** `SourceAsset`에
  `binaryContent: Blob | null`을 추가하고(`textContent`와 상호 배타),
  `URL.createObjectURL`로 렌더링한다. object URL은 세션 동안 명시적으로
  revoke하지 않는다(SPA 화면 전환이 잦아 정교한 해제 시점 관리는 이번
  범위 밖 — KNOWN_LIMITATIONS.md).
- **basename 충돌 버그를 자체 발견해 수정**: 실제 자산 파일 중
  `0006.webp`가 물리(P)·생물(B) 두 과목 폴더에 동시에 존재해, 기존
  basename 매칭 방식대로면 하나가 다른 하나를 덮어썼을 것이다. 사용자가
  보고하기 전에 `find ... | xargs -n1 basename | sort | uniq -d`로 먼저
  발견해 `RawContentPackageFiles.assetTextByBasename/assetBinaryByBasename`
  → `assetTextByPath/assetBinaryByPath`(패키지 루트 기준 전체 상대경로 키)로
  바꾸고, 수입기 UI도 `webkitdirectory`로 전환했다. Chromium에서 실제 두
  `0006.webp`를 동시에 가져와 IndexedDB에 서로 다른 바이트 크기(145,766 vs
  124,040)로 정확히 분리 저장되는 것과, 리더 화면에서 올바른 이미지가
  렌더되는 것까지 확인했다.
- **처음에는 공식 샘플 4개 dossier(P001/C099/B001/E083)만 변환·검증했고,
  이후 사용자 요청("자연과학 변환 ㄱㄱ")으로 720문항 전체를 실제로
  변환·가져오기까지 검증했다.** dossier 추출은 패키지 자체의
  `tools/export_question.py`(파일당 매번 패키지 재로딩)를 그대로 720번
  부르는 대신, `packlib.load()`로 한 번만 로딩한 뒤 그 `tables`를
  `build_dossier()`에 재사용하는 짧은 드라이버를 새로 짜서 14초 만에 720개를
  뽑았다(export_question.py 자체는 건드리지 않았다 — 이미 안전성을 확인한
  코드를 그대로 재사용). `convert_astra_samples.py`에 `--dossier-dir`/
  `--pack-id`/`--content-version`/`--generated-by` 옵션을 추가해 전체 배치도
  지원하도록 확장했다(기본 동작인 샘플 4개 경로는 회귀 테스트로 재확인 —
  결과 동일).
  - **실제 규모 데이터로 버그 2건을 발견해 고쳤다** (4개 샘플만으로는
    드러나지 않던 문제들):
    1. 1,370개 분석 단위 중 88%(1,213개)는 아직 확정 근거 연결이 없는
       "후보 매핑만" 단계라 원래 코드가 가정한 `evidence_link_review`
       객체 자체가 없고 최상위 `review_status` 필드만 있어 `KeyError`로
       전체 변환이 실패했다. 최상위 필드로 폴백하되, 유일한 새 값
       (`mapping_and_evidence_candidates_only`)만 우리
       `EvidenceVerificationStatus`의 `'not_reviewed'`로 매핑했다 — 나머지
       4가지 실제 값(`verified_direct`/`verified_rule_application`/
       `partial`/`unlinked`)은 이미 우리 enum과 정확히 일치했다.
    2. `ExamQuestion.currentLawAnswer`(민법 통합 때 추가한 4번째 답 축)를
       화면에서 무조건 `.value`로 접근해, 이 필드 자체가 없는 자연과학
       데이터에서 `Cannot read properties of undefined` 런타임 오류가
       났다. `currentLawAnswer`를 선택 필드(`?: ExamAnswerClaim`)로 바꾸고
       화면 코드를 옵셔널 체이닝으로 고쳤다 — 패키지마다 있는 선택 필드
       구성이 다를 수 있다는 걸 실제 데이터로 보여준 사례다.
  - Chromium에서 파싱 0오류·검증 0이슈(1,370개 학습 항목/720개 문항/989개
    문단/821개 자산 등 정확히 일치) → dry-run/적용(신규 1,370·충돌 0) →
    연결된 문단 35개 중 21개 표본을 O/X 풀이까지 진행해 pageerror 0건까지
    확인했다.
  - **이 720문항 결과물(49MB, `astra-import/converted/`)은 처음엔 저장소
    밖(`/tmp`)에만 뒀다가, 이후 사용자에게 "이대로 커밋하면 실제 기출문제
    원문·해설이 public 저장소에서 누구나 볼 수 있게 된다"고 명시적으로
    확인을 구했다. 사용자가 "public이어도 상관없음, 그냥 커밋해도 됨"을
    선택**해 `astra-import/converted/`에 실제로 커밋했다(코드에 대한
    동의와 실제 저작물 콘텐츠 공개에 대한 동의를 분리해 별도로 확인한
    것 — 처음에는 코드 공개 동의만 있었고 콘텐츠 자체는 보류해 뒀었다).
- **실제 저작물 콘텐츠(변환된 JSONL, 이미지 등)를 결국 커밋했다.**
  `licenseScope: "personal-exam-prep-restricted"`로 표시된 개인용 제한
  콘텐츠이고 이 저장소는 공개(public) 저장소이지만, 사용자가 이 사실을
  명시적으로 알고 "그냥 커밋해도 됨"이라고 확인했다. 처음에는 "코드
  공개 동의 ≠ 콘텐츠 공개 동의"로 보고 변환기 코드만 커밋했었는데,
  이번에 콘텐츠 자체의 공개 여부를 따로 물어 별도 동의를 받았다.

## 민법 콘텐츠 통합(hoedoksil_civil_final_v1 패키지) 관련 결정

- **민법 패키지(680문항, 2010~2026, 58개 장 기본서 완결본)를 2개 zip 파트로 받아
  병합 후 사용자에게 통합 범위를 다시 물었다.** 자연과학 패키지보다 구조가 더
  복잡하고(5지선다, 이미지 전용 문항 160개, 조문/판례 발췌가 별도 content_role,
  공식/제공/AI/현행법 4갈래 정답 구분) 이미 680문항 전체가 완결·검증된 상태라
  전량을 한 번에 변환할지 공식 샘플부터 검증할지가 새로운 갈림길이었다.
  **사용자가 "공식 샘플 2문항 먼저"를 선택**해 이번 세션은 패키지에 포함된
  공식 완결 샘플 2개(2011-08, 2011-14)만 변환·검증했다.
- **패키지 자체의 무결성 검증기(`tools/validate_package.py`)를 먼저 실행해
  0오류를 확인했다**(68,618 레코드, 33개 컬렉션, 이미지 81장 디코딩, PDF
  1,842페이지 구조 확인, 2개 공식 샘플의 렌더링 결과가 원본 컬렉션 재조합과
  바이트까지 일치함을 자체 검증 — jsonschema 4.26.0/Pillow 12.3.0(자연과학
  때 이미 설치)/PyMuPDF 1.26.7을 추가 설치). 실행 전 5개 파이썬 도구
  (`package_io.py`/`validate_package.py`/`import_content.py`/
  `test_importer.py`/`audit/evidence_delta/tools/apply_delta.py`) 전문을
  읽어 네트워크 호출·파괴적 동작이 없고 경로 이스케이프 가드가 있음을
  확인했다 — SQLite 트랜잭션 기반 참조 구현이지만 "실제 앱이 IndexedDB를
  쓰면 같은 키·해시 사전조건·원자성 규칙을 이식하라"고 README가 명시해,
  우리 importRepository의 기존 원자적 적용 방식이 이 요구를 이미 충족한다고
  판단했다(새로 이식할 것 없음).
- **33개 원본 컬렉션을 직접 순회하는 대신 패키지가 이미 제공하는 완결
  렌더링 샘플(`samples/*.complete.json`)을 그대로 소비했다.** 이 샘플은
  질문·지문·선지·진술·제공 해설·AI 학습자료·근거 연결·참조 문단까지 전부
  포함하고, 패키지 자체 검증기가 "33개 컬렉션에서 재조합한 값과 바이트까지
  동일"함을 이미 보증한다. 680문항 전체로 확장할 때는 패키지의
  `tools/read_question.py`로 각 문항의 완결 뷰를 미리 뽑아 같은 변환기를
  재사용하면 된다(`civil-import/tools/convert_civil_samples.py`의 독스트링에
  기재).
- **`ExamQuestion`에 `currentLawAnswer`(현행법 재검토 답) 필드를 추가했다.**
  이 패키지에서 처음 등장하는 4번째 답 축이며(공식/제공/AI와 서로 대체
  불가), 두 샘플 모두 `status: 'not_reviewed'`라 화면에는 아직 아무것도
  표시되지 않지만 필드 자체는 스키마에 반영해 다음 배치에서 값이 채워져도
  구조 변경 없이 표시할 수 있게 했다.
- **`ParagraphRole`에 `case_excerpt`(판례 원문 발췌)를 추가했다.** 두 샘플이
  참조하는 기본서 문단의 `content_role` 중 `case_original_excerpt`에 대응한다.
  그 외 관찰된 값(`author_exposition`, `author_explanation_of_excerpt`)은
  기존 `narrative`로 충분해 새 역할을 만들지 않았다.
- **`EvidenceRole`/`EvidenceRelation`은 새 값을 추가하지 않고 변환기에서
  이름만 매핑했다.** 패키지의 `relationRole`(core_evidence/exception/
  prerequisite/example)과 `stanceToProvidedClaim`(supports/refutes/...)이
  자연과학 패키지 때 이미 정의해 둔 우리 enum과 의미상 그대로 겹쳐서다
  (`exception`→`exception_or_limitation`, `example`→`source_example`만
  이름 변환).
- **`SolutionStep`이라는 새 엔터티를 만들지 않았다.** 2011-14 샘플의
  계산 단계 4건은 전용 엔터티를 새로 설계하기엔 이번 2문항 증분 범위에서
  너무 작아(YAGNI), 대응하는 AI 해설(ExplanationSegment, origin=
  'ai_reasoning') 텍스트에 이어붙이는 방식으로 흡수했다. 680문항 전체
  변환에서 SolutionStep이 많이 나오면 그때 별도 타입을 만드는 편이 낫다.
- **버그 수정(민법 통합 중 발견, 자연과학에도 동일하게 있던 문제)**:
  `itemAnswerFlow.ts`가 해설 구간을 `EvidenceLink.explanationSegmentId`
  경로로만 찾고 있었는데, 이 필드는 "제공 해설" 하나만 가리키므로 같은
  판단 단위의 "AI 추론" 해설 구간이 화면에 전혀 나타나지 않고 있었다(민법
  샘플에서 둘 다 실제로 존재해서 발견 — 자연과학 샘플도 같은 구조라 동일하게
  누락되고 있었을 것). `ExplanationSegment.analysisUnitId`로 직접 조회하도록
  고쳐 같은 판단 단위의 모든 해설 구간(출처 무관)이 보이게 했다. 새 IndexedDB
  인덱스 없이 질문 단위로 이미 가져온 목록을 클라이언트에서 필터링하는
  방식이라 마이그레이션이 필요 없다.
- **실제 콘텐츠(변환된 2문항 결과물, 원본 패키지)는 이 저장소에 커밋하지
  않는다.** 자연과학 패키지와 같은 이유(라이선스 제한 콘텐츠 + public
  저장소) — `civil-import/tools/convert_civil_samples.py`(변환기 코드)만
  커밋한다.

## 민법 680문항 전체 배치 변환(후속 세션) 관련 결정

- **`samples/*.complete.json`을 미리 뽑아 두는 중간 단계를 두지 않고,
  변환기가 패키지의 `tools/read_question.py::render_question`을 문항마다
  직접 import해서 호출하도록 바꿨다.** 원래 독스트링은 "read_question.py로
  680개 파일을 미리 뽑아 samples/ 상당 위치에 저장한 뒤 변환기가 그걸
  읽게 하라"고 되어 있었지만, 렌더링 결과(문항당 약 160KB, 680개면 100MB+)를
  디스크에 두 번 쓸 이유가 없어 함수를 바로 호출하는 쪽을 택했다 - 렌더링
  로직은 여전히 패키지 쪽 `read_question.py`에만 있고 이 변환기는 그 출력
  형태만 소비하므로 원래 의도(33개 원본 컬렉션을 직접 순회하지 않는다)는
  그대로 지켰다.
- **`PackageReader`를 문항마다 새로 만들지 않고 공유 인스턴스로 캐싱했다.**
  `render_question()`은 호출마다 `PackageReader(root)`를 새로 만드는데,
  그 생성자가 `registry/entities.jsonl`(68,618행, 25MB)을 매번 처음부터
  다시 인덱싱한다 - 680번 반복하면 이 재인덱싱만으로 수십 분이 걸린다(실측:
  최적화 전 680문항 중 600개 처리에 2분 30초 넘게 걸리고도 안 끝남).
  패키지 파일이 실행 중 바뀌지 않는다는 전제로 `PackageReader`를 한 번만
  만들고 이후 생성자 호출은 그 인스턴스의 `__dict__`를 복제하도록
  바꿔치기해서, 680문항 전체 변환이 20초 내외로 끝나게 했다. 변환 로직
  자체는 건드리지 않았다(성능 최적화만).
- **이미지 전용 문항(160건)에서 실제로 드러난 버그를 고쳤다: 지문이 여러
  개인 문항에서 마지막 지문만 남는 문제.** 텍스트 문항(2011-08/14)의
  해설은 항상 `targetEntityType: 'Statement'`를 가리켜 분석 단위 id가
  자연히 서로 달랐지만, 이미지 전용 문항의 해설은 `targetEntityType:
  'Question'`이라 `targetEntityId`가 곧 문항 id 자신이다. 기존 변환기가
  그 값을 그대로 분석 단위 id로 썼기 때문에, 한 문항에 지문이 여러 개(예:
  2010-01은 5개)면 `analysis_units[qid]`/`learning_items[qid]`가 계속
  덮어써져 마지막 지문 하나만 남았을 것이다(2문항 검증 때는 둘 다 텍스트
  문항이라 이 경로를 타지 않아 발견되지 않았다). explanation 자신의 id를
  분석 단위 id로 쓰도록 고쳐 지문마다 별도 학습 항목이 생기게 했다 - 실행
  결과 이 경로로 777개 학습 항목이 만들어졌고, 대표로 확인한 2010-01은
  지문 5개가 모두 살아있음을 확인했다.
- **이미지 전용 문항의 스캔 페이지 이미지을 `source-assets.jsonl` +
  `assets/`로 이번에 처음 내보냈다.** 기존 변환기는 `questionAssetId`를
  항상 `None`으로 고정해 두고 있었다(자산 지원 자체가 없었음). 자연과학
  변환기(`astra-import/tools/convert_astra_samples.py`)가 이미 같은 문제를
  풀어 둔 패턴(자산 id로 중복 등록 방지 + 파일 복사 + `path`/`mimeType`/
  `sha256` 기록)을 그대로 재사용했다 - 민법 패키지의 `exam.assets` 레코드는
  sha256/byteLength를 이미 갖고 있어 재계산하지 않고 그대로 신뢰했다(패키지
  전체가 `SHA256SUMS.txt`와 자체 검증기로 이미 무결성 확인됨). 결과: 고유
  스캔 이미지 75개(11MB) - 160개 문항이 페이지를 공유해서(한 페이지에 문항
  최대 3개) 이미지 수보다 문항 수가 많다. 2페이지짜리 문항 1건(2010-19)은
  `ExamQuestion.questionAssetId`(단일 값 타입)엔 첫 페이지만 담기고, 두
  페이지 다 필요하다는 사실은 `LearningItem.requiredAssetIds`에만 남는다 -
  타입을 배열로 바꾸는 건 이번 범위 밖이라 알려진 한계로 남겼다.
- **결과물을 `parseContentPackage`/`validatePackage`(앱이 실제 수입 UI에서
  쓰는 코드 그대로)로 검증했다.** 680문항 → learningItems 3306,
  examQuestions 680, analysisUnits 3306, evidenceLinks 1962,
  explanationSegments 6612, hints 6612, sourceAssets 75, textbookParagraphs
  779 - parseErrors 0, validationIssues(중복 id/끊긴 참조/누락 자산 등) 0.
  이어서 Chromium으로 실제 dev 서버에서 "설정 탭 → 가져오기" UI를 클릭해
  680문항 전체를 IndexedDB에 적용까지 재현했다: 미리보기 단계에서 위 카운트가
  그대로 뜨고, 적용 결과는 신규 3306 · 건너뜀 0. 이후 2010~2025년에 걸쳐
  무작위로 뽑은 21문항 + 2페이지 자산 문항 1건(2010-19)까지 총 22건을 실제로
  열어 O 선택 → 확신도 → 제출까지 눌러봤고, 전부 "채점 보류" 결과 화면과
  해설·근거 문단 버튼이 정상 렌더링되었으며 콘솔 에러는 0건이었다(이미지
  전용 문항은 스캔 페이지 이미지가 blob URL로 실제로 표시됨도 확인). 680문항
  전부를 하나하나 열어본 것은 아니라서, 이 샘플에 없는 나머지 문항 중
  개별적으로 깨지는 사례가 있을 가능성은 남아 있다.
- **변환된 680문항 결과물(JSONL + 스캔 이미지)은 이번에도 저장소에
  커밋하지 않고 사용자에게 파일로 전달했다.** 원본 패키지와 같은 이유
  (`licenseScope: personal-exam-prep-restricted`, 이 저장소는 public) -
  이 세션에서 저장소에 커밋한 것은 `convert_civil_samples.py`의 수정과
  이 문서들뿐이다.

## 로컬 전용 모드

- 19.6절대로 로그인 없이 로컬 모드로 동작하며, `learnerId`는 고정 문자열
  `'local'`을 사용한다. 계정 연결/기존 이벤트 마이그레이션 로직은 서버 인증이
  없으므로 구현하지 않았다.
