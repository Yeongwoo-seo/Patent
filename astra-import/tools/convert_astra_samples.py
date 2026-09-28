#!/usr/bin/env python3
"""Astra 자연과학 최종 콘텐츠 패키지의 완결 샘플 dossier 4개(P001/C099/B001/E083)를
회독실 앱의 content-package 포맷(JSONL, 도메인 타입 1:1 대응)으로 변환한다.

이 스크립트는 "만드는" 쪽만 담당한다. 실제 반영(가져오기)은
src/features/importer/renderImporter.ts + src/data/repositories/importRepository.ts가 한다.

전체 720문항으로 확장하려면: 원본 패키지의 tools/export_question.py로 각 문항 ID의
dossier JSON을 뽑은 뒤, 이 스크립트의 SAMPLE_IDS 목록에 추가하고 --pack/--out만
바꿔 다시 실행하면 된다(로직은 바뀌지 않는다).

실행: python3 astra-import/tools/convert_astra_samples.py \
        --pack /tmp/astra-ns/Astra_NaturalScience_Final_Content_v1.0.0 \
        --out /tmp/astra-converted
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
from pathlib import Path

SAMPLE_IDS = ["P001", "C099", "B001", "E083"]

SUBJECT_MAP = {
    "physics": "physics",
    "chemistry": "chemistry",
    "biology": "biology",
    "earth": "earth_science",
}

# base.blocks.block_type/roles -> 앱 ParagraphRole. 매핑 없는 값은 'narrative'로 떨어진다.
ROLE_MAP = {
    "derivation_step": "derivation_step",
    "definition": "definition",
    "principle": "principle",
    "example": "example",
    "figure": "figure",
    "formula": "formula",
}

EXPLANATION_ORIGIN_MAP = {
    "existing_batch_ai_explanation_not_new": "ai_reasoning",
    "existing_provided_learning_explanation_range": "provided_explanation",
}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_component_text(question_original: dict, component_id: str) -> str:
    structure = question_original["structure"]
    candidates = [structure["stem"], *structure["statements"], *structure["choices"], *structure.get("context_segments", [])]
    for c in candidates:
        if c["id"] == component_id:
            return c.get("text_display_transcribed") or c["text_original"]
    return ""


def map_role(block: dict) -> str:
    for role in block.get("roles", []):
        if role in ROLE_MAP:
            return ROLE_MAP[role]
    return ROLE_MAP.get(block.get("block_type", ""), "narrative")


def map_explanation_origin(origin: str) -> str:
    return EXPLANATION_ORIGIN_MAP.get(origin, "recovered_textbook_body")


class Converter:
    def __init__(self, pack_root: Path, out_dir: Path):
        self.pack_root = pack_root
        self.out_dir = out_dir
        self.learning_items = {}
        self.grading_specs = {}
        self.textbook_paragraphs = {}
        self.content_links = {}
        self.source_assets = {}
        self.exam_questions = {}
        self.analysis_units = {}
        self.evidence_links = {}
        self.explanation_segments = {}
        self.formulas = {}
        self.hints = {}
        self.review_questions = {}
        self._asset_id_by_pack_path = {}

    def register_asset(self, asset_entry: dict, is_synthetic: bool = False) -> str:
        pack_path = asset_entry["pack_path"]
        if pack_path in self._asset_id_by_pack_path:
            return self._asset_id_by_pack_path[pack_path]
        asset_id = "asset:" + pack_path
        self._asset_id_by_pack_path[pack_path] = asset_id
        ext = Path(pack_path).suffix.lower()
        mime = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "application/octet-stream")
        src = self.pack_root / pack_path
        self.source_assets[asset_id] = {
            "id": asset_id,
            "kind": "image",
            "path": "assets/" + pack_path,
            "mimeType": mime,
            "sha256": asset_entry.get("sha256") or sha256_file(src),
            "byteSize": src.stat().st_size,
            "isSynthetic": is_synthetic,
            "licenseScope": "personal-exam-prep-restricted",
            "sourceLocation": asset_entry.get("source_path"),
        }
        dest = self.out_dir / "assets" / pack_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copyfile(src, dest)
        return asset_id

    def find_asset_id_by_namespace_path(self, dossier_assets: list[dict], namespace: str, path: str) -> str | None:
        for a in dossier_assets:
            if a["namespace"] == namespace and a["source_path"] == path:
                return self.register_asset(a)
        return None

    def convert_dossier(self, dossier_path: Path) -> None:
        d = json.loads(dossier_path.read_text(encoding="utf8"))
        q = d["question_original"]
        qid = d["question_id"]
        subject_id = SUBJECT_MAP[q["subject_id"]]
        dossier_assets = d["assets"]

        # --- textbook paragraphs (모든 원문 블록을 통째로 들여온다 - dossier가 "완결" 보증) ---
        for block in d["textbook_blocks_original"]:
            bid = block["block_id"]
            if bid in self.textbook_paragraphs:
                continue
            asset_ids = []
            page_asset_id = self.find_asset_id_by_namespace_path(dossier_assets, "base", block["reader"]["source_page_asset"])
            if page_asset_id:
                asset_ids.append(page_asset_id)
            self.textbook_paragraphs[bid] = {
                "id": bid,
                "subjectId": subject_id,
                "bookId": block["book_id"],
                "chapter": block["unit_id"],
                "section": block.get("section_id") or block["unit_id"],
                "paragraphIndex": block["source_locator"]["pdf_page"],
                "role": map_role(block),
                "text": block["original_text"],
                "assetIds": asset_ids,
                "isSynthetic": False,
            }

        # --- exam question ---
        question_asset_id = self.find_asset_id_by_namespace_path(dossier_assets, "batch", q["source_question_asset"])
        choices = [
            {"id": c["id"], "label": c["label"], "textDisplay": c.get("text_display_transcribed") or c["text_original"]}
            for c in q["structure"]["choices"]
        ]

        def answer_claim(raw: dict) -> dict:
            return {"value": raw.get("value"), "status": raw["status"]}

        self.exam_questions[qid] = {
            "id": qid,
            "subjectId": subject_id,
            "examName": q["exam"]["name"],
            "examYear": q["exam"]["year"],
            "examNumber": q["exam"]["number"],
            "textNative": q["text_native"],
            "questionAssetId": question_asset_id,
            "choices": choices,
            "officialAnswer": answer_claim(q["answers"]["official_answer"]),
            "providedAnswer": answer_claim(q["answers"]["provided_explanation_answer"]),
            "aiInferredAnswer": answer_claim(q["answers"]["ai_inferred_answer"]),
            "standaloneOxEnabled": d["effective_view"]["standalone_ox_enabled"] in (True, "True"),
            "isSynthetic": False,
        }

        # --- analysis units -> LearningItem + GradingSpec (ungraded: 공식 정답 미검증) ---
        for a in d["analyses"]:
            aid = a["id"]
            target_text = resolve_component_text(q, a["target_component_id"]) or a.get("question_core") or ""
            self.analysis_units[aid] = {
                "id": aid,
                "questionId": qid,
                "targetText": target_text,
                "stepNumber": a.get("step_number"),
                "stepTitle": a.get("step_title"),
                "questionCore": a.get("question_core"),
                "reasoningAi": a["decisive_evidence"].get("reasoning_ai"),
                "truthValueAi": a.get("truth_value_ai"),
                "truthStatus": a.get("truth_status") or "unresolved_or_not_applicable",
                "reviewStatus": a["evidence_link_review"]["status"],
                "standaloneOxEligible": bool(a.get("standalone_ox_eligible")),
                "evidenceLinkIds": list(a["evidence_link_review"]["evidence_link_ids"]),
            }
            self.learning_items[aid] = {
                "id": aid,
                "subjectId": subject_id,
                "kind": "exam_statement",
                "sourceContentId": qid,
                "contentRevisionId": "astra-v1",
                "learningEpoch": 0,
                "topicIds": [a["primary_unit_id"]] if a.get("primary_unit_id") else [],
                "relatedItemIds": [],
                "requiredAssetIds": [question_asset_id] if question_asset_id else [],
                "availableContexts": ["micro", "focused"],
                "canStandaloneOX": bool(a.get("standalone_ox_eligible")),
                "requiresIndependentSolve": False,
                "gradingSpecId": aid + ":spec",
                "verification": "unverified",
                "isSynthetic": False,
                "prompt": target_text or f"{qid} 판단 단위 {a.get('step_number')}",
            }
            self.grading_specs[aid + ":spec"] = {
                "id": aid + ":spec",
                "kind": "ox",
                "verification": "unverified",
                "contentRevisionId": "astra-v1",
            }

        # --- evidence links + explanation segments + content links ---
        for l in d["evidence_links"]:
            lid = l["link_id"]
            block_id = l["textbook"]["block_id"]
            self.evidence_links[lid] = {
                "id": lid,
                "analysisUnitId": l["source"]["analysis_unit_id"],
                "questionId": qid,
                "textbookBlockId": block_id,
                "quoteOriginal": l["textbook"]["quote_original"],
                "role": l["role"],
                "relationToOrigin": l["relation_to_origin"],
                "verificationStatus": l["verification"]["status"],
                "reason": l.get("reason"),
                "explanationSegmentId": l.get("corresponding_explanation_segment_id"),
            }
            link_id = "link:" + lid
            self.content_links[link_id] = {
                "id": link_id,
                "fromId": l["source"]["analysis_unit_id"],
                "toId": block_id,
                "relation": "derived_from",
                "sourceLocation": l["textbook"]["quote_original"][:120] if l["textbook"].get("quote_original") else None,
            }

        for s in d["explanation_segments"]:
            sid = s["segment_id"]
            self.explanation_segments[sid] = {
                "id": sid,
                "questionId": qid,
                "analysisUnitId": s.get("analysis_unit_id"),
                "origin": map_explanation_origin(s["origin"]),
                "official": bool(s.get("official")),
                "textOriginal": s["text_original"],
            }

        for f in d["formulas_as_recorded"]:
            fid = f["formula_id"]
            if f["block_id"] not in self.textbook_paragraphs:
                continue
            asset_ids = []
            for asset_id_raw in f.get("source_asset_ids", []):
                # base.assets id는 dossier 최상위 assets 목록에 sha 매칭 정보가 없어 직접 연결하지 않고
                # 텍스트 상태만 보존한다(이번 변환의 알려진 단순화 - KNOWN_LIMITATIONS 참고).
                del asset_id_raw
            self.formulas[fid] = {
                "id": fid,
                "blockId": f["block_id"],
                "originalText": f.get("original_text") or "",
                "latex": f.get("latex"),
                "latexStatus": "transcribed" if f.get("latex") else "not_transcribed",
                "sourceAssetIds": asset_ids,
            }

        for h in d["hints"]:
            self.hints[h["id"]] = {
                "id": h["id"],
                "questionId": qid,
                "text": h["text"],
                "specificity": h["specificity"],
            }

        for r in d["review_questions"]:
            self.review_questions[r["id"]] = {
                "id": r["id"],
                "questionId": qid,
                "text": r["text"],
                "answer": r.get("answer"),
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
            ("source-assets.jsonl", self.source_assets),
            ("exam-questions.jsonl", self.exam_questions),
            ("analysis-units.jsonl", self.analysis_units),
            ("evidence-links.jsonl", self.evidence_links),
            ("explanation-segments.jsonl", self.explanation_segments),
            ("formulas.jsonl", self.formulas),
            ("hints.jsonl", self.hints),
            ("review-questions.jsonl", self.review_questions),
        ]:
            rel, count = self.write_jsonl(name, records)
            full = self.out_dir / rel
            files.append({
                "path": rel,
                "sha256": sha256_file(full),
                "byteSize": full.stat().st_size,
                "recordCount": count,
            })

        manifest = {
            "schemaVersion": "1.0.0",
            "packId": "hoedoksil-natural-science-samples-v1",
            "namespace": "astra-natural-science",
            "contentVersion": "1.0.0-samples",
            "isSynthetic": False,
            "subjectIds": sorted({q["subjectId"] for q in self.exam_questions.values()}),
            "generatedAt": "1970-01-01T00:00:00Z",
            "generatedBy": "astra-import/tools/convert_astra_samples.py (샘플 4문항만 - 720문항 전체 아님)",
            "licenseScope": "personal-exam-prep-restricted",
            "files": files,
            "legacyIdMap": {},
            "verificationSummary": {"verified": 0, "needsReview": 0, "unverified": len(self.grading_specs), "disputed": 0},
        }
        (self.out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pack", type=Path, required=True, help="병합된 Astra 자연과학 패키지 루트")
    p.add_argument("--out", type=Path, required=True, help="출력 디렉터리(회독실 content-package 포맷)")
    p.add_argument("--samples", nargs="*", default=SAMPLE_IDS)
    args = p.parse_args()

    conv = Converter(args.pack, args.out)
    for sid in args.samples:
        conv.convert_dossier(args.pack / "samples" / f"{sid}.json")
    conv.write_all()

    print(f"변환 완료: learningItems={len(conv.learning_items)} examQuestions={len(conv.exam_questions)} "
          f"analysisUnits={len(conv.analysis_units)} evidenceLinks={len(conv.evidence_links)} "
          f"explanationSegments={len(conv.explanation_segments)} textbookParagraphs={len(conv.textbook_paragraphs)} "
          f"sourceAssets={len(conv.source_assets)} formulas={len(conv.formulas)} hints={len(conv.hints)} "
          f"reviewQuestions={len(conv.review_questions)}")


if __name__ == "__main__":
    main()
