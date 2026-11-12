from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
)
from app.services.document_store import (
    get_document_from_disk,
    list_documents_from_disk,
    list_versions_from_disk,
)

router = APIRouter(prefix="/documents", tags=["Документы и Версионирование"])


@router.get("/", response_model=List[DocumentItem])
async def list_documents(db: Session = Depends(get_db)):
    """Возвращает документы из папки documents, разрешенные текущей роли (RBAC)."""
    current_user = get_active_user(db)
    clearance = get_role_clearance(current_user.role)
    return list_documents_from_disk(min_clearance=clearance)


@router.get("/{doc_id}/versions", response_model=List[DocumentVersionItem])
async def list_document_versions(doc_id: str, db: Session = Depends(get_db)):
    """Возвращает историю версий документа из папки documents/.versions с проверкой RBAC (AI-02, AI-07)."""
    current_user = get_active_user(db)
    doc = get_document_from_disk(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден.")
    enforce_document_clearance(db, doc, current_user, "VIEW_DOCUMENT_VERSIONS")
    return list_versions_from_disk(doc_id)


@router.post("/draft", response_model=DocumentDraftResponse)
async def create_document_draft(req: DocumentDraftRequest, db: Session = Depends(get_db)):
    """Генерирует AI-черновик и diff-превью без записи в папку documents до явного подтверждения (AI-03)."""
    current_user = get_active_user(db)
    return await generate_document_draft(db, req, current_user)


@router.post("/diff-preview", response_model=List[DocumentDiffLine])
async def preview_document_diff(req: DocumentDiffPreviewRequest):
    """Пересчитывает построчный diff между исходным и отредактированным текстом."""
    return compute_line_diff(req.originalContent, req.proposedContent)


@router.post("/commit", response_model=DocumentItem)
async def commit_document(req: DocumentCommitRequest, db: Session = Depends(get_db)):
    """Явное подтверждение сохранения нового документа или новой версии в папку documents (AI-03, AI-07)."""
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
