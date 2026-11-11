from fastapi import APIRouter
from typing import List
from app.db.storage import storage
from app.schemas import DocumentItem, RAGQueryRequest, RAGResponse
from app.services.rag_engine import execute_rag_search, get_role_clearance

router = APIRouter(prefix="/rag", tags=["База знаний и RAG"])

@router.get("/documents", response_model=List[DocumentItem])
async def get_documents():
    """
    Возвращает документы, разрешенные текущей роли пользователя.
    """
    current_user = storage.get_current_user()
    clearance = get_role_clearance(current_user.role)
    return [doc for doc in storage.documents if doc.minClearance >= clearance]

@router.post("/query", response_model=RAGResponse)
async def query_knowledge_base(req: RAGQueryRequest):
    return await execute_rag_search(req.query, req.userRole)
