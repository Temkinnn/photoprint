from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from app.db.models import DBDocument
from app.db.session import get_db
from app.schemas import DocumentItem, RAGQueryRequest, RAGResponse
from app.services.audit import get_active_user, get_role_clearance
from app.services.rag_engine import execute_rag_search

router = APIRouter(prefix="/rag", tags=["База знаний и RAG"])


@router.get("/documents", response_model=List[DocumentItem])
async def get_documents(db: Session = Depends(get_db)):
    """Возвращает документы из PostgreSQL, разрешенные текущей роли пользователя (RBAC AI-02)."""
    current_user = get_active_user(db)
    clearance = get_role_clearance(current_user.role)
    docs = (
        db.query(DBDocument)
        .filter(DBDocument.min_clearance >= clearance)
        .all()
    )
    return [
        DocumentItem(
            id=d.id,
            title=d.title,
            category=d.category,
            date=d.date,
            minClearance=d.min_clearance,
            summary=d.summary,
            content=d.content,
            version=d.version or 1,
        )
        for d in docs
    ]


@router.post("/query", response_model=RAGResponse)
async def query_knowledge_base(req: RAGQueryRequest, db: Session = Depends(get_db)):
    return await execute_rag_search(db, req.query, req.userRole)
