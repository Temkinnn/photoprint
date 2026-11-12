import io
import os
import sys
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from app.config import settings
from app.db.seed import seed_database
from app.services.document_store import get_documents_dir


def _build_minimal_docx_bytes(paragraphs: list[str]) -> bytes:
    """Создает минимальный валидный .docx (ZIP + word/document.xml) для теста чтения из папки documents."""
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )
    body_xml = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body_xml}</w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", doc_xml)
    return buf.getvalue()


def test_file_based_documents_workflow():
    with tempfile.TemporaryDirectory() as tmp_dir:
        original_docs_dir = settings.DOCUMENTS_DIR
        settings.DOCUMENTS_DIR = tmp_dir
        try:
            seed_database(force=True)
            docs_dir = get_documents_dir()

            # 1. All 20 seeded documents exist as real .md files in documents folder + .versions
            md_files = sorted(p.name for p in docs_dir.glob("*.md"))
            assert len(md_files) == 20, f"Expected 20 .md files, got {len(md_files)}"
            assert (docs_dir / ".versions" / "doc-fin-01").exists()

            async def fake_chat(messages, **kwargs):
                return "По данным документа из папки documents: регламент соблюдается."

            with TestClient(app) as client:
                # 2. Manually drop .txt, .docx, and subfolder finance/.txt directly into documents/
                dropped_txt = docs_dir / "custom_courier_rule.txt"
                dropped_txt.write_text(
                    "Регламент экспресс-доставки: курьеры выезжают в 10:00 и 16:00 с фотоотчетом.",
                    encoding="utf-8",
                )

                dropped_docx = docs_dir / "custom_packaging_note.docx"
                dropped_docx.write_bytes(
                    _build_minimal_docx_bytes(
                        ["Стандарт упаковки фотокниг в жесткий картонный тубус с маркировкой QR-кодом."]
                    )
                )

                fin_dir = docs_dir / "finance"
                fin_dir.mkdir(exist_ok=True)
                dropped_fin = fin_dir / "secret_bonus_memo.txt"
                dropped_fin.write_text(
                    "Секретный меморандум по премиям дирекции: коэффициент 1.45.",
                    encoding="utf-8",
                )

                # Switch to Director -> sees 20 + 3 dropped = 23 docs
                client.post("/api/v1/auth/switch-role", json={"role": "ROLE_DIRECTOR"})
                docs_res = client.get("/api/v1/documents/")
                assert docs_res.status_code == 200
                all_docs = docs_res.json()
                assert len(all_docs) == 23, f"Expected 23 docs, got {len(all_docs)}"
                txt_doc = next(d for d in all_docs if "экспресс-доставки" in d["content"])
                docx_doc = next(d for d in all_docs if "картонный тубус" in d["content"])
                fin_doc = next(d for d in all_docs if "секретный меморандум" in d["content"].lower())
                assert txt_doc["minClearance"] == 3
                assert docx_doc["minClearance"] == 3
                assert fin_doc["minClearance"] == 1

                # 3. Dropped file is immediately searchable via RAG
                with patch("app.services.rag_engine.chat_with_ollama", side_effect=fake_chat):
                    rag_res = client.post(
                        "/api/v1/rag/query",
                        json={"query": "Во сколько выезжают курьеры экспресс-доставки?", "userRole": "ROLE_DIRECTOR"},
                    )
                assert rag_res.status_code == 200
                rag_json = rag_res.json()
                assert rag_json["status"] == "grounded"
                assert any(c["documentId"] == txt_doc["id"] for c in rag_json["citations"])

                # 3b. Dropped .docx file can be used in prepare-agenda
                with patch("app.services.meeting_prep.chat_with_ollama", return_value='{"agenda":["1. Упаковка (10 мин)"],"openQuestions":["• Готовность тубусов?"]}'):
                    prep_res = client.post(
                        "/api/v1/meetings/prepare-agenda",
                        json={
                            "topic": "Упаковка фотокниг",
                            "participants": ["Иванов И.С."],
                            "selectedDocIds": [docx_doc["id"]],
                        },
                    )
                assert prep_res.status_code == 200, prep_res.text
                assert any(docx_doc["title"] in u for u in prep_res.json()["usedDocuments"])

                # 4. RBAC check: Support Head (clearance 3) CANNOT see or access dropped finance/*.txt
                sw_res = client.post("/api/v1/auth/switch-role", json={"role": "ROLE_SUPPORT_HEAD"})
                assert sw_res.status_code == 200
                sup_docs = client.get("/api/v1/documents/").json()
                assert all(d["id"] != fin_doc["id"] for d in sup_docs)
                deny_ver = client.get(f"/api/v1/documents/{fin_doc['id']}/versions")
                assert deny_ver.status_code == 403

                # 5. Create new document via /documents/commit -> saved as real .md file inside documents/
                client.post("/api/v1/auth/switch-role", json={"role": "ROLE_DIRECTOR"})
                create_res = client.post(
                    "/api/v1/documents/commit",
                    json={
                        "mode": "create",
                        "title": "Приказ о хранении регламентов на диске",
                        "category": "Общие регламенты",
                        "minClearance": 3,
                        "summary": "Все документы хранятся в папке documents.",
                        "content": "Пункт 1. Все актуальные регламенты хранятся в папке documents в формате Markdown.",
                        "changeNote": "Первое утверждение приказа",
                    },
                )
                assert create_res.status_code == 200, create_res.text
                created = create_res.json()
                created_files = list(docs_dir.glob(f"{created['id']}_*.md"))
                assert len(created_files) == 1, "New document file was not created in documents/"
                assert "в формате Markdown" in created_files[0].read_text(encoding="utf-8")

                # 6. Edit created doc -> v2 written directly to the file, then Rollback -> v3 append-only
                edit_res = client.post(
                    "/api/v1/documents/commit",
                    json={
                        "mode": "edit",
                        "documentId": created["id"],
                        "title": created["title"],
                        "category": created["category"],
                        "minClearance": 3,
                        "summary": created["summary"],
                        "content": "Пункт 1. Все актуальные регламенты хранятся в папке documents.\nПункт 2. Ревизия v2.",
                        "changeNote": "Добавлен пункт 2",
                    },
                )
                assert edit_res.status_code == 200
                v2_doc = edit_res.json()
                assert v2_doc["version"] == 2
                assert "Ревизия v2." in created_files[0].read_text(encoding="utf-8")

                versions = client.get(f"/api/v1/documents/{created['id']}/versions").json()
                assert [v["versionNumber"] for v in versions] == [2, 1]
                v1_id = next(v["id"] for v in versions if v["versionNumber"] == 1)

                rb_res = client.post(
                    f"/api/v1/documents/{created['id']}/rollback",
                    json={"versionId": v1_id},
                )
                assert rb_res.status_code == 200
                rb_doc = rb_res.json()
                assert rb_doc["version"] == 3
                assert "Ревизия v2." not in created_files[0].read_text(encoding="utf-8")

                versions_after = client.get(f"/api/v1/documents/{created['id']}/versions").json()
                assert [v["versionNumber"] for v in versions_after] == [3, 2, 1]

                # 7. Reset demo restores clean 20 baseline .md files
                reset_res = client.post("/api/v1/system/reset-demo")
                assert reset_res.status_code == 200
                assert len(list(docs_dir.glob("*.md"))) == 20
                assert not dropped_txt.exists()

            print("FILE_DOCUMENTS_WORKFLOW_PASSED")
        finally:
            settings.DOCUMENTS_DIR = original_docs_dir


if __name__ == "__main__":
    test_file_based_documents_workflow()
