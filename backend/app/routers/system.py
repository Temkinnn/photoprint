from fastapi import APIRouter
from app.db.storage import storage

router = APIRouter(prefix="/system", tags=["Системные операции"])

@router.post("/reset-demo")
async def reset_demo_state():
    """
    Сброс состояния БД и аудита к эталонному начальному состоянию для жюри (AI-06 / ОТ-01).
    """
    storage.reset_to_default()
    storage.add_audit_log(
        action="DEMO_RESET",
        target="Системное хранилище данных",
        status="success",
        details="Состояние системы успешно сброшено к эталонным демонстрационным данным"
    )
    return {
        "status": "success",
        "message": "Демо-стенд сброшен к исходному состоянию"
    }
