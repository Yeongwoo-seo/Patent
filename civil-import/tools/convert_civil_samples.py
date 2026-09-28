#!/usr/bin/env python3
"""민법 최종 콘텐츠 패키지(hoedoksil_civil_final_v1)의 공식 샘플 2문항(2011-08,
2011-14)을 회독실 앱의 content-package 포맷(JSONL, 도메인 타입 1:1 대응)으로
변환한다.

패키지 자체가 이미 문항별로 완결된 samples/*.complete.json(원문+지문+선지+
진술+제공 해설+AI 학습자료+근거 연결+참조 문단까지 전부 포함)을 제공하므로,
이 스크립트는 33개 원본 컬렉션(schemas/collections.json)을 직접 순회하지
않고 그 완결 샘플만 소비한다. 680문항 전체로 확장하려면 패키지의
tools/read_question.py로 각 문항의 완결 뷰를 미리 뽑아 samples/ 상당 위치에
저장한 뒤 SAMPLE_IDS를 넓히면 된다(변환 로직 자체는 바뀌지 않는다).

이 스크립트는 "만드는" 쪽만 담당한다. 실제 반영(가져오기)은
src/features/importer/renderImporter.ts + src/data/repositories/importRepository.ts가 한다.

실행: python3 civil-import/tools/convert_civil_samples.py \
        --pack /tmp/civil-law-pack/hoedoksil_civil_final_v1 \
        --out /tmp/civil-converted
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

SAMPLE_IDS = ["2011-08", "2011-14"]

# 민법 패키지 evidenceBindings.relationRole -> 앱 EvidenceRole (자연과학 패키지와 이름이
# 조금 다르다: 'exception'/'example'이 아니라 'exception_or_limitation'/'source_example').
ROLE_MAP = {
    "core_evidence": "core_evidence",
    "exception": "exception_or_limitation",
    "prerequisite": "prerequisite",
    "example": "source_example",
}

# stanceToProvidedClaim -> 앱 EvidenceRelation. 두 샘플에 나온 값(supports/refutes)은
# 이름이 그대로 겹치지만, 매핑 없는 값이 나오면 'supports'로 떨어뜨리지 않고 원본을 남긴다.
RELATION_MAP = {
    "supports": "supports",
    "refutes": "refutes",
    "context_only": "context_only",
    "supports_conditionally": "supports_conditionally",
}

# 링크 effectiveUseStatus(evidence_checked/needs_review/unmatched, 3단계) -> 앱
# EvidenceVerificationStatus(5단계). 이 패키지는 개별 binding에 더 상세한
# verificationStatus 문자열도 갖고 있지만 자유 서술형이라 그대로 옮기지 않는다.
LINK_STATUS_MAP = {
    "evidence_checked": "verified_direct",
    "needs_review": "partial",
    "unmatched": "unlinked",
}
STATUS_RANK = {"unlinked": 0, "not_semantically_reviewed": 1, "partial": 1, "verified_rule_application": 2, "verified_direct": 3}

# base.blocks.contentRole -> 앱 ParagraphRole. 매핑 없는 값(author_exposition 등)은
# 'narrative'로 떨어진다 - 두 샘플에서 실제로 관찰된 값만 명시적으로 옮긴다.
PARAGRAPH_ROLE_MAP = {
    "case_original_excerpt": "case_excerpt",
}


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def paragraph_location(block_id: str) -> tuple[str, str, int]:
    """블록 id 관찰 패턴 '{chapter}-{section}-B{n}' 또는 '{chapter}-{section}'에서
    chapter/section/순번을 뽑는다. 패키지가 렌더링된 문단 객체 자체에는 별도
    chapter_id/section_id 필드를 내려주지 않아 id 규칙에 의존한다 - 규칙이 다른
    블록이 섞이면(예: 예외적인 표 블록) 어긋날 수 있다(KNOWN_LIMITATIONS 기재)."""
    parts = block_id.split("-")
    chapter = parts[0]
    section = "-".join(parts[:2]) if len(parts) >= 2 else chapter
    index = 0
    if parts and parts[-1].startswith("B") and parts[-1][1:].isdigit():
        index = int(parts[-1][1:])
    return chapter, section, index


def answer_claim(raw: dict, option_by_ordinal: dict[int, str]) -> dict:
    numbers = raw.get("optionNumbers")
    value = [option_by_ordinal[n] for n in numbers if n in option_by_ordinal] if numbers else None
    status = raw.get("status") or raw.get("reportedOrigin") or "unknown"
    return {"value": value, "status": status}


class Converter:
    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        self.learning_items: dict = {}
        self.grading_specs: dict = {}
        self.textbook_paragraphs: dict = {}
        self.content_links: dict = {}
        self.exam_questions: dict = {}
        self.analysis_units: dict = {}
        self.evidence_links: dict = {}
        self.explanation_segments: dict = {}
        self.hints: dict = {}
        self._evidence_link_seq = 0

    def register_paragraph(self, block: dict) -> None:
        bid = block["id"]
        if bid in self.textbook_paragraphs:
            return
        chapter, section, index = paragraph_location(bid)
        self.textbook_paragraphs[bid] = {
            "id": bid,
            "subjectId": "civil",
            "bookId": block["bookId"],
            "chapter": chapter,
            "section": section,
            "paragraphIndex": index,
            "role": PARAGRAPH_ROLE_MAP.get(block["contentRole"], "narrative"),
            "text": block["originalText"],
            # 민법 기본서는 스캔 페이지가 아니라 JSON 원문(디지털 텍스트)이라 페이지 이미지이 없다.
            "assetIds": [],
            "isSynthetic": False,
        }

    def convert_sample(self, sample_path: Path) -> None:
        d = json.loads(sample_path.read_text(encoding="utf8"))
        q = d["sourceQuestion"]
        qid = q["id"]

        options_by_id = {o["id"]: o for o in d["options"]}
        statements_by_id = {s["id"]: s for s in d["statements"]}
        option_by_ordinal = {o["ordinal"]: o["id"] for o in d["options"]}

        choices = [{"id": o["id"], "label": o["label"], "textDisplay": o["normalizedText"]} for o in d["options"]]

        ar = q["answerReview"]
        self.exam_questions[qid] = {
            "id": qid,
            "subjectId": "civil",
            "examName": q["examName"],
            "examYear": q["year"],
            "examNumber": q["questionNumber"],
            "textNative": q["originalText"],
            "questionAssetId": None,
            "choices": choices,
            "officialAnswer": answer_claim(ar["officialAnswer"], option_by_ordinal),
            "providedAnswer": answer_claim(ar["providedExplanationAnswer"], option_by_ordinal),
            "aiInferredAnswer": answer_claim(ar["aiAnswer"], option_by_ordinal),
            "currentLawAnswer": answer_claim(ar["currentLawAnswer"], option_by_ordinal),
            # 이 패키지는 모든 선지/진술이 지문(context)에 종속된다(canBecomeContextlessOX
            # 항상 false, DATA_CONTRACT/validate_package.py의 불변조건).
            "standaloneOxEnabled": False,
            "isSynthetic": False,
        }

        # 풀이 단계(있으면) 텍스트를 대응 explanationSegmentId 기준으로 모아 둔다 - 별도
        # SolutionStep 엔터티를 새로 만들지 않고 AI 해설(ai_reasoning 구간)에 합쳐 넣는다
        # (이번 2문항 증분에서는 4건뿐이라 새 엔터티 도입은 범위 밖 - KNOWN_LIMITATIONS).
        step_text_by_explanation: dict[str, list[str]] = {}
        for step in d["solutionSteps"]:
            text = step["title"]
            if step.get("calculation"):
                c = step["calculation"]
                text += f" ({c['expression']} = {c['result']}{c['unit']})"
            else:
                text += " " + step["text"]
            for eid in step["viaExplanationSegmentIds"]:
                step_text_by_explanation.setdefault(eid, []).append(text)

        for e in d["explanations"]:
            sr = e["sourceRecord"]
            eid = sr["id"]
            target_id = sr["targetEntityId"]
            target = statements_by_id.get(target_id) or options_by_id.get(target_id)
            target_text = target["normalizedText"] if target else (sr.get("quotedQuestionOrStatementText") or "")

            truth = {"O": True, "X": False}.get(sr.get("providedJudgmentLabel"))
            truth_status = {True: "true", False: "false"}.get(truth, "unresolved_or_not_applicable")

            link_ids: list[str] = []
            review_status = "not_reviewed"
            for link in e["links"]:
                mapped_status = LINK_STATUS_MAP.get(link["effectiveUseStatus"], "not_semantically_reviewed")
                if review_status == "not_reviewed" or STATUS_RANK.get(mapped_status, 0) < STATUS_RANK.get(review_status, 99):
                    review_status = mapped_status
                for binding in link["confirmedEvidence"] + link.get("conflictEvidence", []):
                    self.register_paragraph(binding["paragraph"])
                    for ctx_block in binding["requiredTextbookContext"]:
                        self.register_paragraph(ctx_block)
                    self._evidence_link_seq += 1
                    lid = f"evlink:{eid}:{self._evidence_link_seq}"
                    self.evidence_links[lid] = {
                        "id": lid,
                        "analysisUnitId": target_id,
                        "questionId": qid,
                        "textbookBlockId": binding["textbook"]["paragraphId"],
                        "quoteOriginal": binding["textbook"]["range"]["exactText"],
                        "role": ROLE_MAP.get(binding["relationRole"], "core_evidence"),
                        "relationToOrigin": RELATION_MAP.get(binding["stanceToProvidedClaim"], "supports"),
                        "verificationStatus": mapped_status,
                        "reason": link.get("reason"),
                        "explanationSegmentId": binding["explanationSegmentId"],
                    }
                    link_ids.append(lid)
                    content_link_id = "link:" + lid
                    self.content_links[content_link_id] = {
                        "id": content_link_id,
                        "fromId": target_id,
                        "toId": binding["textbook"]["paragraphId"],
                        "relation": "derived_from",
                        "sourceLocation": binding["textbook"]["range"]["exactText"][:120],
                    }

            self.analysis_units[target_id] = {
                "id": target_id,
                "questionId": qid,
                "targetText": target_text,
                "stepNumber": None,
                "stepTitle": None,
                "questionCore": None,
                "reasoningAi": None,  # 아래에서 aiLearningMaterial로 채운다(ExplanationSegment 쪽에 보존)
                "truthValueAi": truth,
                "truthStatus": truth_status,
                "reviewStatus": review_status,
                "standaloneOxEligible": False,
                "evidenceLinkIds": link_ids,
            }

            self.learning_items[target_id] = {
                "id": target_id,
                "subjectId": "civil",
                "kind": "exam_statement",
                "sourceContentId": qid,
                "contentRevisionId": "civil-v1",
                "learningEpoch": 0,
                "topicIds": [q["sourceQuestionPrimaryChapterId"]] if q.get("sourceQuestionPrimaryChapterId") else [],
                "relatedItemIds": [],
                "requiredAssetIds": [],
                "availableContexts": ["micro", "focused"],
                "canStandaloneOX": False,
                "requiresIndependentSolve": False,
                "gradingSpecId": target_id + ":spec",
                "verification": "unverified",
                "isSynthetic": False,
                "prompt": target_text or f"{qid} 판단 단위",
            }
            self.grading_specs[target_id + ":spec"] = {
                "id": target_id + ":spec",
                "kind": "ox",
                "verification": "unverified",
                "contentRevisionId": "civil-v1",
            }

            # 제공 해설(원문 그대로) - official=False, 공식 정답이 아니다(DATA_CONTRACT).
            self.explanation_segments[eid] = {
                "id": eid,
                "questionId": qid,
                "analysisUnitId": target_id,
                "origin": "provided_explanation",
                "official": False,
                "textOriginal": sr["originalText"],
            }

            # AI 학습자료(IssueAnalysis) - 별도 해설 구간으로 분리해 출처를 구분한다(7장).
            ai = e.get("aiLearningMaterial")
            if ai:
                ai_text = ai.get("coreQuestion") or ""
                decisive = ai.get("decisiveEvidence") or {}
                if decisive.get("text"):
                    ai_text += "\n" + decisive["text"]
                for extra in step_text_by_explanation.get(eid, []):
                    ai_text += "\n" + extra
                self.explanation_segments[ai["id"]] = {
                    "id": ai["id"],
                    "questionId": qid,
                    "analysisUnitId": target_id,
                    "origin": "ai_reasoning",
                    "official": False,
                    "textOriginal": ai_text.strip(),
                }
                for h in ai.get("hints", []):
                    hid = f"{ai['id']}:hint:{h['level']}"
                    self.hints[hid] = {
                        "id": hid,
                        "questionId": qid,
                        "text": h["text"],
                        "specificity": f"level_{h['level']}",
                    }

    def write_jsonl(self, name: str, records: dict) -> tuple[str, int]:
        path = self.out_dir / "data" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in records.values()]
        path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf8")
        return f"data/{name}", len(records)

    def write_all(self) -> None:
        files = []
        for name, records in [
            ("learning-items.jsonl", self.learning_items),
            ("grading-specs.jsonl", self.grading_specs),
            ("textbook-paragraphs.jsonl", self.textbook_paragraphs),
            ("content-links.jsonl", self.content_links),
            ("exam-questions.jsonl", self.exam_questions),
            ("analysis-units.jsonl", self.analysis_units),
            ("evidence-links.jsonl", self.evidence_links),
            ("explanation-segments.jsonl", self.explanation_segments),
            ("hints.jsonl", self.hints),
        ]:
            rel, count = self.write_jsonl(name, records)
            full = self.out_dir / rel
            files.append({"path": rel, "sha256": sha256_file(full), "byteSize": full.stat().st_size, "recordCount": count})

        manifest = {
            "schemaVersion": "1.0.0",
            "packId": "hoedoksil-civil-samples-v1",
            "namespace": "hoedoksil-civil",
            "contentVersion": "1.0.0-samples",
            "isSynthetic": False,
            "subjectIds": ["civil"],
            "generatedAt": "1970-01-01T00:00:00Z",
            "generatedBy": "civil-import/tools/convert_civil_samples.py (공식 샘플 2문항만 - 680문항 전체 아님)",
            "licenseScope": "personal-exam-prep-restricted",
            "files": files,
            "legacyIdMap": {},
            "verificationSummary": {"verified": 0, "needsReview": 0, "unverified": len(self.grading_specs), "disputed": 0},
        }
        (self.out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pack", type=Path, required=True, help="병합된 민법 최종 패키지 루트(hoedoksil_civil_final_v1)")
    p.add_argument("--out", type=Path, required=True, help="출력 디렉터리(회독실 content-package 포맷)")
    p.add_argument("--samples", nargs="*", default=SAMPLE_IDS)
    args = p.parse_args()

    conv = Converter(args.out)
    for sid in args.samples:
        conv.convert_sample(args.pack / "samples" / f"{sid}.complete.json")
    conv.write_all()

    print(f"변환 완료: learningItems={len(conv.learning_items)} examQuestions={len(conv.exam_questions)} "
          f"analysisUnits={len(conv.analysis_units)} evidenceLinks={len(conv.evidence_links)} "
          f"explanationSegments={len(conv.explanation_segments)} textbookParagraphs={len(conv.textbook_paragraphs)} "
          f"hints={len(conv.hints)}")


if __name__ == "__main__":
    main()
