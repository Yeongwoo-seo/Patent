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
- **파일 선택은 `<input type=file multiple>` + 파일명 매칭**으로 구현했다.
  `webkitdirectory`로 폴더 전체를 선택하는 방식은 브라우저별 동작 차이와
  자동화 테스트(Playwright) 안정성 문제가 있어 피했다. 대신 패키지 안의
  모든 파일명이 서로 겹치지 않는다는 전제(README_FOR_CLAUDE.md의 고정
  레이아웃)로 basename만 보고 역할을 매칭한다 — 여러 패키지를 동시에
  선택하면 오동작할 수 있다는 뜻이고, KNOWN_LIMITATIONS.md에 적어뒀다.
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

## 로컬 전용 모드

- 19.6절대로 로그인 없이 로컬 모드로 동작하며, `learnerId`는 고정 문자열
  `'local'`을 사용한다. 계정 연결/기존 이벤트 마이그레이션 로직은 서버 인증이
  없으므로 구현하지 않았다.
