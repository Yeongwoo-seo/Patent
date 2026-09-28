# README_FOR_CLAUDE.md

이 패키지는 회독실 앱이 **재분석 없이 그대로 가져올 수 있도록** 앱의 도메인
타입(`src/domain/types.ts`, `src/domain/reader/types.ts`)과 1:1로 맞춘
JSON/JSONL 콘텐츠 패키지다. 전부 **테스트용 가상 자료**다(`isSynthetic: true`).

## 구성

```text
manifest.json              패키지 메타(버전/해시/레코드수/검증요약) - schema/manifest.schema.json
schema/*.schema.json        각 data/*.jsonl 레코드의 스키마
data/*.jsonl                실제 콘텐츠 (1줄 = 1레코드, UTF-8, LF)
  learning-items.jsonl        LearningItem  (14건)
  grading-specs.jsonl         GradingSpec   (14건)
  duration-rules.jsonl        DurationRule  (2건)
  textbook-paragraphs.jsonl   TextbookParagraph (3건)
  content-links.jsonl         ContentLink   (6건)
  choice-options.jsonl        선택형 문항의 선택지 텍스트 (4건, 앱에 정식 Question/Option
                               엔터티가 아직 없어 쓰는 임시 포맷 - schema/choice-option.schema.json)
  source-assets.jsonl         SourceAsset   (3건, 앱 IndexedDB에는 아직 이 store 없음)
assets/images/*.svg          그림 자산 (표장 예시, 판 경계 지도 예시)
assets/formulas/*.json       수식 자산 (latex + TTS 읽기 문장, 8.9)
IMPORT_RULES.md              기존 학습 기록을 덮어쓰지 않는 수입·업데이트 규칙 (먼저 읽을 것)
VALIDATION_REPORT.md/.json   기계 검증 결과 (파싱/중복ID/참조/자산/해시)
REVIEW_QUEUE.md              사람이 확인해야 하는 미검증 항목 목록
tools/                       build-package.mjs, validate-package.mjs, generate-review-queue.mjs
```

## 가져오는 방법

1. `IMPORT_RULES.md`를 먼저 읽는다 — 기존 `attemptEvents`/`reviewStates`는
   이 패키지가 절대 건드리지 않는다는 것과, id 재사용 시 `learningEpoch` 처리
   규칙이 핵심이다.
2. `node content-package/tools/validate-package.mjs`로 기계 검증을 통과시킨다
   (현재 오류 0건).
3. `data/*.jsonl`을 한 줄씩 파싱해 앱의 `learningItems`/`gradingSpecs`/
   `durationRules`/`textbookParagraphs`/`contentLinks` object store에 그대로
   upsert한다 — 필드명이 이미 앱 타입과 동일하므로 변환/재해석이 필요 없다.
4. `data/source-assets.jsonl`과 `assets/`는 앱에 아직 대응 store가 없다
   (`SourceAsset`). 수입기를 구현할 때 store를 추가하고, `assets/` 파일을
   Cache Storage 등 오프라인 자산 저장소에 복사한다.
5. `data/choice-options.jsonl`은 앱에 정식 Question/Option 엔터티가 생기기
   전까지 쓰는 임시 포맷이다 — 그대로 옮기거나, 엔터티가 생기면 그쪽으로
   재구조화한다.
6. 반영 전/후 레코드 수를 `manifest.json.files[].recordCount`와 대조해
   확인한다.

## 재검증 방법 (패키지가 바뀐 뒤)

```bash
node --experimental-strip-types content-package/tools/build-package.mjs   # 재생성(소스 fixtures 기준)
node content-package/tools/validate-package.mjs                          # 기계 검증
node content-package/tools/generate-review-queue.mjs                     # 검토 목록 갱신
```

의존 패키지: 없음 (Node.js 18+ 내장 모듈만 사용 — `node:crypto`, `node:fs`,
`node:path`, `node:url`). `build-package.mjs`만 `--experimental-strip-types`
플래그가 필요하다(앱 소스 `.ts` 파일을 직접 import하기 때문).
