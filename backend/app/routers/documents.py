from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import DBDocument, DBDocumentVersion
from app.db.session import get_db
from app.schemas import (
    DocumentCommitRequest,
    DocumentDiffLine,
    DocumentDiffPreviewRequest,
    DocumentDraftRequest,
    DocumentDraftResponse,
    DocumentItem,
    DocumentRollbackRequest,
    DocumentVersionItem,
)
from app.services.audit import get_active_user, get_role_clearance
from app.services.document_editor import (
    commit_document_change,
    compute_line_diff,
    enforce_document_clearance,
    generate_document_draft,
    rollback_document_version,
    to_document_item,
    to_version_item,
)

router = APIRouter(prefix="/documents", tags=["Документы и Версионирование"])


@router.get("/", response_model=List[DocumentItem])
async def list_documents(db: Session = Depends(get_db)):
    """Возвращает документы из PostgreSQL, разрешенные текущей роли (RBAC)."""
    current_user = get_active_user(db)
    clearance = get_role_clearance(current_user.role)
    docs = (
        db.query(DBDocument)
        .filter(DBDocument.min_clearance >= clearance)
        .order_by(DBDocument.id.asc())
        .all()
    )
    return [to_document_item(d) for d in docs]


@router.get("/{doc_id}/versions", response_model=List[DocumentVersionItem])
async def list_document_versions(doc_id: str, db: Session = Depends(get_db)):
    """Возвращает историю версий документа с проверкой RBAC (AI-02, AI-07)."""
    current_user = get_active_user(db)
    doc = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден.")
    enforce_document_clearance(db, doc, current_user, "VIEW_DOCUMENT_VERSIONS")

    versions = (
        db.query(DBDocumentVersion)
        .filter(DBDocumentVersion.document_id == doc_id)
        .order_by(DBDocumentVersion.version_number.desc())
        .all()
    )
    return [to_version_item(v) for v in versions]


@router.post("/draft", response_model=DocumentDraftResponse)
async def create_document_draft(req: DocumentDraftRequest, db: Session = Depends(get_db)):
    """Генерирует AI-черновик и diff-превью без записи в базу до явного подтверждения (AI-03)."""
    current_user = get_active_user(db)
    return await generate_document_draft(db, req, current_user)


@router.post("/diff-preview", response_model=List[DocumentDiffLine])
async def preview_document_diff(req: DocumentDiffPreviewRequest):
    """Пересчитывает построчный diff между исходным и отредактированным текстом."""
    return compute_line_diff(req.originalContent, req.proposedContent)


@router.post("/commit", response_model=DocumentItem)
async def commit_document(req: DocumentCommitRequest, db: Session = Depends(get_db)):
    """Явное подтверждение сохранения нового документа или новой версии в PostgreSQL (AI-03, AI-07)."""
    current_user = get_active_user(db)
    return commit_document_change(db, req, current_user)


@router.post("/{doc_id}/rollback", response_model=DocumentItem)
async def rollback_document(
    doc_id: str,
    req: DocumentRollbackRequest,
    db: Session = Depends(get_db),
):
    """Откат документа к выбранной исторической версии с сохранением новой ревизии (AI-07)."""
    current_user = get_active_user(db)
    return rollback_document_version(db, doc_id, req.versionId, current_user)
