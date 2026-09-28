# VALIDATION_REPORT.md

**이 문서는 기계 검증 결과만 담는다.** 콘텐츠(법률/과학) 의미가 실제로 맞는지는
여기서 확인하지 않는다 — 그 목록은 `REVIEW_QUEUE.md`를 본다.

생성 시각(UTC): 2026-09-28T00:05:48.890Z

## 레코드 수

- learningItems: 14
- gradingSpecs: 14
- durationRules: 2
- textbookParagraphs: 3
- contentLinks: 6
- choiceOptions: 4
- sourceAssets: 3

## 결과: ✅ 통과 (오류 0)

- 오류: 0건
- 경고(오류 아님): 0건

## 검사 항목 (코드로 수행)

- JSON 파싱 (`json_parse`)
- 스키마 필수 필드/타입/enum (`schema`, `schema/*.schema.json` 기준)
- 컬렉션 내 ID 중복 (`duplicate_id`)
- 항목 간 참조 무결성: gradingSpecId, relatedItemIds, ContentLink.fromId/toId (`broken_reference`)
- 선택형 문항의 정답 ID가 실제 선택지 목록에 있는지 (`invalid_correct_option`, `missing_choice_options`)
- 필수 자산 참조가 source-assets.jsonl에 존재하는지 (`missing_asset`)
- 자산 파일이 디스크에 실재하는지 + sha256/크기 일치 (`missing_asset_file`, `hash_mismatch`, `size_mismatch`)
- manifest.json에 선언된 해시/크기가 실제 파일과 일치하는지 (`manifest_hash_mismatch`, `manifest_size_mismatch`)
- 참조되지 않는 고아 자산 (`orphan_asset`, 경고)

## 이 스크립트가 검증하지 못하는 것

- 조문/판례/계산의 실제 정오 (콘텐츠 의미) — `REVIEW_QUEUE.md`
- 이미지가 문제 의도와 실제로 맞는지(예: 그림이 정답과 모순되지 않는지)
- 저작권/라이선스 적법성
