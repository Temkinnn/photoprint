import hashlib
import io
import json
import os
import re
import shutil
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.config import project_root, settings
from app.db.storage import INITIAL_DOCUMENTS
from app.schemas import DocumentItem, DocumentVersionItem

SUPPORTED_DOC_EXTENSIONS = {".md", ".txt", ".docx"}
VERSIONS_DIR_NAME = ".versions"

_CYRILLIC_TO_LATIN = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


@dataclass
class StoredDocumentRecord:
    """Представление документа, загруженного из файловой папки documents."""

    item: DocumentItem
    file_path: Path
    managed: bool


def get_documents_dir() -> Path:
    """Возвращает абсолютный путь к папке documents и гарантирует ее существование."""
    raw = (settings.DOCUMENTS_DIR or "").strip()
    path = Path(raw) if raw else Path(project_root) / "documents"
    if not path.is_absolute():
        path = Path(project_root) / path
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _get_versions_root(docs_dir: Path) -> Path:
    versions_dir = docs_dir / VERSIONS_DIR_NAME
    versions_dir.mkdir(parents=True, exist_ok=True)
    return versions_dir


def _sanitize_doc_id(doc_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", (doc_id or "").strip()).strip("-.")
    if not cleaned:
        raise ValueError("Некорректный идентификатор документа.")
    return cleaned[:96]


def _slugify_filename(text: str, max_len: int = 44) -> str:
    safe = re.sub(r'[<>:"/\\|?*«»]+', "", (text or "").strip())
    safe = re.sub(r"\s+", "_", safe).strip("._")
    return safe[:max_len] or "document"


def _transliterate_slug(text: str) -> str:
    out: List[str] = []
    for ch in (text or "").lower():
        if ch in _CYRILLIC_TO_LATIN:
            out.append(_CYRILLIC_TO_LATIN[ch])
        elif ch.isalnum() or ch in ("-", "_"):
            out.append(ch)
        else:
            out.append("-")
    slug = re.sub(r"-+", "-", "".join(out)).strip("-_")
    return slug[:48]


def extract_docx_text(file_bytes: bytes) -> str:
    """Извлекает читаемый текст (включая таблицы) из .docx файла без внешних зависимостей."""
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        xml_bytes = zf.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: List[str] = []
    for p in root.findall(".//w:body//w:p", ns):
        texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
        joined = "".join(texts).strip()
        if joined:
            paragraphs.append(joined)
    return "\n".join(paragraphs).strip()


def _decode_text_bytes(raw: bytes) -> str:
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1251", errors="replace")


def _parse_scalar(raw_val: str) -> str:
    val = raw_val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        if val.startswith('"'):
            try:
                parsed = json.loads(val)
                return str(parsed)
            except Exception:
                pass
        return val[1:-1]
    return val


def _parse_frontmatter(raw_text: str) -> Tuple[Dict[str, str], str]:
    normalized = raw_text.replace("\r\n", "\n")
    lines = normalized.split("\n")
    if not lines or lines[0].strip() != "---":
        return {}, normalized.strip()

    end_idx: Optional[int] = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_idx = idx
            break
    if end_idx is None:
        return {}, normalized.strip()

    meta: Dict[str, str] = {}
    for line in lines[1:end_idx]:
        if ":" not in line:
            continue
        key, raw_val = line.split(":", 1)
        key_clean = key.strip()
        if key_clean:
            meta[key_clean] = _parse_scalar(raw_val)

    body = "\n".join(lines[end_idx + 1 :]).strip()
    return meta, body


def _render_markdown_document(item: DocumentItem) -> str:
    lines = [
        "---",
        f"id: {json.dumps(item.id, ensure_ascii=False)}",
        f"title: {json.dumps(item.title, ensure_ascii=False)}",
        f"category: {json.dumps(item.category, ensure_ascii=False)}",
        f"date: {json.dumps(item.date, ensure_ascii=False)}",
        f"minClearance: {int(item.minClearance)}",
        f"version: {int(item.version or 1)}",
        f"summary: {json.dumps(item.summary, ensure_ascii=False)}",
        "---",
        "",
        item.content.strip(),
        "",
    ]
    return "\n".join(lines)


def _infer_clearance_and_category(rel_path: Path, body_text: str) -> Tuple[int, str]:
    parts_lower = [p.lower() for p in rel_path.parts[:-1]]
    stem_lower = rel_path.stem.lower()

    if any(k in part for part in parts_lower for k in ("finance", "fin", "финанс", "director", "дирекц")):
        return 1, "Финансы и стратегия"
    if any(k in part for part in parts_lower for k in ("prod", "производ", "tech", "цех")):
        return 2, "Производство / Регламенты"
    if any(k in part for part in parts_lower for k in ("support", "клиент", "сервис")):
        return 3, "Клиентский сервис"

    if stem_lower.startswith("doc-fin-"):
        return 1, "Финансы и стратегия"
    if stem_lower.startswith("doc-prod-"):
        return 2, "Производство / Регламенты"
    if stem_lower.startswith("doc-sup-"):
        return 3, "Клиентский сервис"
    if stem_lower.startswith("doc-gen-"):
        return 3, "Общие регламенты"

    clearance_match = re.search(r"Clearance:\s*([123])", body_text, re.IGNORECASE)
    if clearance_match:
        return int(clearance_match.group(1)), "Корпоративные документы"

    folder_cat = rel_path.parts[0] if len(rel_path.parts) > 1 else "Корпоративные документы"
    return 3, folder_cat


def _derive_doc_id(rel_path: Path, meta: Dict[str, str]) -> str:
    if meta.get("id"):
        return _sanitize_doc_id(meta["id"])

    known_prefix = re.match(r"^(doc-[a-z]+-\d+)(?:_|$)", rel_path.stem, re.IGNORECASE)
    if known_prefix:
        return _sanitize_doc_id(known_prefix.group(1).lower())

    rel_posix = rel_path.as_posix()
    slug = _transliterate_slug(rel_path.stem) or "doc"
    short_hash = hashlib.sha1(rel_posix.encode("utf-8")).hexdigest()[:6]
    return _sanitize_doc_id(f"doc-{slug}-{short_hash}")


def _extract_heading_title(body_text: str, fallback: str) -> str:
    for line in body_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip()
            if heading:
                return heading[:240]
        break
    return fallback


def _read_version_files(docs_dir: Path, doc_id: str) -> List[DocumentVersionItem]:
    ver_dir = _get_versions_root(docs_dir) / _sanitize_doc_id(doc_id)
    if not ver_dir.exists() or not ver_dir.is_dir():
        return []
    versions: List[DocumentVersionItem] = []
    for path in ver_dir.glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            versions.append(DocumentVersionItem(**payload))
        except Exception:
            continue
    versions.sort(key=lambda v: v.versionNumber, reverse=True)
    return versions


def _write_version_file(docs_dir: Path, version: DocumentVersionItem) -> None:
    ver_dir = _get_versions_root(docs_dir) / _sanitize_doc_id(version.documentId)
    ver_dir.mkdir(parents=True, exist_ok=True)
    target = ver_dir / f"v{version.versionNumber}_{_sanitize_doc_id(version.id)}.json"
    target.write_text(
        json.dumps(version.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _scan_document_records() -> List[StoredDocumentRecord]:
    docs_dir = get_documents_dir()
    records_by_id: Dict[str, StoredDocumentRecord] = {}

    for path in sorted(docs_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(docs_dir)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if path.name.startswith("~$"):
            continue
        ext = path.suffix.lower()
        if ext not in SUPPORTED_DOC_EXTENSIONS:
            continue

        try:
            raw_bytes = path.read_bytes()
            if ext == ".docx":
                raw_text = extract_docx_text(raw_bytes)
                meta, body = {}, raw_text
            else:
                raw_text = _decode_text_bytes(raw_bytes)
                meta, body = _parse_frontmatter(raw_text)
        except Exception:
            continue

        if not body and not meta.get("title"):
            continue

        managed = bool(meta.get("id"))
        doc_id = _derive_doc_id(rel, meta)
        inferred_clearance, inferred_category = _infer_clearance_and_category(rel, body)

        try:
            clearance = int(meta["minClearance"]) if "minClearance" in meta else inferred_clearance
        except (TypeError, ValueError):
            clearance = inferred_clearance
        if clearance not in (1, 2, 3):
            clearance = inferred_clearance

        title = (meta.get("title") or "").strip() or _extract_heading_title(
            body, rel.stem.replace("_", " ").strip() or doc_id
        )
        category = (meta.get("category") or "").strip() or inferred_category
        mtime_date = datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")
        date_str = (meta.get("date") or "").strip() or mtime_date
        summary = (meta.get("summary") or "").strip()
        if not summary:
            preview_src = " ".join(body.split())
            summary = preview_src[:180].rstrip() + ("..." if len(preview_src) > 180 else "")

        stored_versions = _read_version_files(docs_dir, doc_id)
        try:
            version_num = int(meta["version"]) if "version" in meta else (stored_versions[0].versionNumber if stored_versions else 1)
        except (TypeError, ValueError):
            version_num = stored_versions[0].versionNumber if stored_versions else 1
        version_num = max(1, version_num)

        item = DocumentItem(
            id=doc_id,
            title=title,
            category=category,
            date=date_str,
            minClearance=clearance,
            summary=summary,
            content=body,
            version=version_num,
        )
        candidate = StoredDocumentRecord(item=item, file_path=path, managed=managed)

        existing = records_by_id.get(doc_id)
        if existing is None or (candidate.managed and not existing.managed):
            records_by_id[doc_id] = candidate

    records = list(records_by_id.values())
    records.sort(key=lambda r: r.item.id)
    return records


def list_documents_from_disk(min_clearance: Optional[int] = None) -> List[DocumentItem]:
    """Возвращает документы из папки documents, опционально фильтруя по уровню допуска RBAC."""
    records = _scan_document_records()
    if min_clearance is None:
        return [r.item for r in records]
    return [r.item for r in records if r.item.minClearance >= min_clearance]


def get_restricted_doc_ids(user_clearance: int) -> List[str]:
    """Возвращает ID документов в папке documents, требующих более высокий допуск."""
    return [r.item.id for r in _scan_document_records() if r.item.minClearance < user_clearance]


def get_document_record(doc_id: str) -> Optional[StoredDocumentRecord]:
    for r in _scan_document_records():
        if r.item.id == doc_id:
            return r
    return None


def get_document_from_disk(doc_id: str) -> Optional[DocumentItem]:
    rec = get_document_record(doc_id)
    return rec.item if rec else None


def list_versions_from_disk(doc_id: str) -> List[DocumentVersionItem]:
    docs_dir = get_documents_dir()
    versions = _read_version_files(docs_dir, doc_id)
    if versions:
        return versions
    rec = get_document_record(doc_id)
    if not rec:
        return []
    return [
        DocumentVersionItem(
            id=f"ver-{rec.item.id}-v{rec.item.version or 1}",
            documentId=rec.item.id,
            versionNumber=rec.item.version or 1,
            title=rec.item.title,
            category=rec.item.category,
            date=rec.item.date,
            minClearance=rec.item.minClearance,
            summary=rec.item.summary,
            content=rec.item.content,
            changeNote="Исходный файл из папки documents",
            changedBy="Файловое хранилище",
            createdAt=f"{rec.item.date} 09:00",
        )
    ]


def get_version_from_disk(doc_id: str, version_id: str) -> Optional[DocumentVersionItem]:
    for ver in list_versions_from_disk(doc_id):
        if ver.id == version_id:
            return ver
    return None


def create_document_on_disk(
    title: str,
    category: str,
    min_clearance: int,
    summary: str,
    content: str,
    changed_by: str,
    change_note: str,
    doc_id: Optional[str] = None,
    date_str: Optional[str] = None,
) -> DocumentItem:
    """Создает новый документ в папке documents и первую запись истории версий v1."""
    docs_dir = get_documents_dir()
    new_id = _sanitize_doc_id(doc_id or f"doc-{uuid.uuid4().hex[:6]}")
    today_str = date_str or datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    item = DocumentItem(
        id=new_id,
        title=title,
        category=category,
        date=today_str,
        minClearance=min_clearance,
        summary=summary,
        content=content,
        version=1,
    )
    filename = f"{new_id}_{_slugify_filename(title)}.md"
    target_path = (docs_dir / filename).resolve()
    if target_path.parent != docs_dir:
        raise ValueError("Недопустимый путь для файла документа.")
    target_path.write_text(_render_markdown_document(item), encoding="utf-8")

    v1 = DocumentVersionItem(
        id=f"ver-{new_id}-v1",
        documentId=new_id,
        versionNumber=1,
        title=item.title,
        category=item.category,
        date=item.date,
        minClearance=item.minClearance,
        summary=item.summary,
        content=item.content,
        changeNote=change_note or "Создание первичной редакции документа v1",
        changedBy=changed_by,
        createdAt=now_str,
    )
    _write_version_file(docs_dir, v1)
    return item


def update_document_on_disk(
    doc_id: str,
    title: str,
    category: str,
    min_clearance: int,
    summary: str,
    content: str,
    changed_by: str,
    change_note: str,
    action_tag: str = "edit",
) -> DocumentItem:
    """Обновляет файл документа в папке documents и добавляет новую append-only версию (AI-07)."""
    docs_dir = get_documents_dir()
    rec = get_document_record(doc_id)
    if not rec:
        raise FileNotFoundError(f"Документ {doc_id} не найден в папке documents.")

    existing_versions = _read_version_files(docs_dir, doc_id)
    if not existing_versions:
        baseline = DocumentVersionItem(
            id=f"ver-{doc_id}-v{rec.item.version or 1}",
            documentId=doc_id,
            versionNumber=rec.item.version or 1,
            title=rec.item.title,
            category=rec.item.category,
            date=rec.item.date,
            minClearance=rec.item.minClearance,
            summary=rec.item.summary,
            content=rec.item.content,
            changeNote="Исходная версия до редактирования",
            changedBy="Файловое хранилище",
            createdAt=f"{rec.item.date} 09:00",
        )
        _write_version_file(docs_dir, baseline)
        current_max_ver = baseline.versionNumber
    else:
        current_max_ver = max(rec.item.version or 1, existing_versions[0].versionNumber)

    next_version = current_max_ver + 1
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    updated = DocumentItem(
        id=doc_id,
        title=title,
        category=category,
        date=today_str,
        minClearance=min_clearance,
        summary=summary,
        content=content,
        version=next_version,
    )

    if rec.file_path.suffix.lower() == ".docx":
        target_path = rec.file_path.with_suffix(".md")
    else:
        target_path = rec.file_path
    target_path.write_text(_render_markdown_document(updated), encoding="utf-8")

    new_ver = DocumentVersionItem(
        id=f"ver-{doc_id}-v{next_version}-{uuid.uuid4().hex[:4]}",
        documentId=doc_id,
        versionNumber=next_version,
        title=updated.title,
        category=updated.category,
        date=updated.date,
        minClearance=updated.minClearance,
        summary=updated.summary,
        content=updated.content,
        changeNote=change_note or (
            f"Обновление текста до версии v{next_version}"
            if action_tag == "edit"
            else f"Откат до редакции v{next_version}"
        ),
        changedBy=changed_by,
        createdAt=now_str,
    )
    _write_version_file(docs_dir, new_ver)
    return updated


def seed_documents_directory(force: bool = False) -> int:
    """Инициализирует папку documents регламентами при первом запуске или сбросе демо (force=True)."""
    docs_dir = get_documents_dir()

    if force:
        for entry in list(docs_dir.iterdir()):
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                try:
                    entry.unlink()
                except OSError:
                    pass

    existing_records = _scan_document_records()
    if existing_records and not force:
        # Гарантируем наличие v1 истории для уже лежащих управляемых .md файлов
        for rec in existing_records:
            if rec.managed and not _read_version_files(docs_dir, rec.item.id):
                _write_version_file(
                    docs_dir,
                    DocumentVersionItem(
                        id=f"ver-{rec.item.id}-v{rec.item.version or 1}",
                        documentId=rec.item.id,
                        versionNumber=rec.item.version or 1,
                        title=rec.item.title,
                        category=rec.item.category,
                        date=rec.item.date,
                        minClearance=rec.item.minClearance,
                        summary=rec.item.summary,
                        content=rec.item.content,
                        changeNote="Исходная утверждённая редакция документа",
                        changedBy="Система ООО «Фотопринт»",
                        createdAt=f"{rec.item.date} 09:00",
                    ),
                )
        return len(existing_records)

    for doc in INITIAL_DOCUMENTS:
        create_document_on_disk(
            title=doc.title,
            category=doc.category,
            min_clearance=doc.minClearance,
            summary=doc.summary,
            content=doc.content,
            changed_by="Система ООО «Фотопринт»",
            change_note="Исходная утверждённая редакция документа",
            doc_id=doc.id,
            date_str=doc.date,
        )
    return len(INITIAL_DOCUMENTS)
