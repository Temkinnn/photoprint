from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas import DocumentItem, RAGQueryRequest, RAGResponse
from app.services.audit import get_active_user, get_role_clearance
from app.services.document_store import list_documents_from_disk
from app.services.rag_engine import execute_rag_search

router = APIRouter(prefix="/rag", tags=["База знаний и RAG"])


@router.get("/documents", response_model=List[DocumentItem])
async def get_documents(db: Session = Depends(get_db)):
    """Возвращает документы из папки documents, разрешенные текущей роли пользователя (RBAC AI-02)."""
    current_user = get_active_user(db)
    clearance = get_role_clearance(current_user.role)
    return list_documents_from_disk(min_clearance=clearance)


@router.post("/query", response_model=RAGResponse)
async def query_knowledge_base(req: RAGQueryRequest, db: Session = Depends(get_db)):
    return await execute_rag_search(db, req.query, req.userRole)
