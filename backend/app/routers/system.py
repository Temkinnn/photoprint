import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config import settings
from app.db.seed import seed_database
from app.db.session import engine, get_db
from app.services.audit import add_audit_log
from app.services.ollama_client import TUNNEL_HEADERS

router = APIRouter(prefix="/system", tags=["Системные операции"])


@router.post("/reset-demo")
async def reset_demo_state(db: Session = Depends(get_db)):
    """Сброс состояния БД (включая слоты, встречи, приглашения и аудит) к эталону для жюри."""
    seed_database(db=db, force=True)
    add_audit_log(
        db,
        action="DEMO_RESET",
        target="База данных PostgreSQL",
        status="success",
        details="Состояние системы, слоты календаря, приглашения и аудит сброшены к эталонным демонстрационным данным",
    )
    return {
        "status": "success",
        "message": "Демо-стенд сброшен к исходному состоянию",
    }


@router.get("/ai-status")
async def get_ai_status():
    """Проверка подключения к удаленному AI-серверу (AI_SERVER_URL) или локальной Ollama и БД."""
    ai_server = (settings.AI_SERVER_URL or "").strip().rstrip("/")
    ollama_url = settings.OLLAMA_BASE_URL.rstrip("/")
    ollama_online = False
    configured_model = settings.OLLAMA_MODEL
    models = []
    error = None

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            if ai_server:
                resp = await client.get(f"{ai_server}/health", headers=TUNNEL_HEADERS)
                if resp.status_code == 200:
                    payload = resp.json()
                    if payload.get("status") == "online":
                        ollama_online = True
                    configured_model = payload.get("ollama_model", configured_model)
                    models = [configured_model]
                else:
                    error = f"HTTP {resp.status_code}: {resp.text[:200]}"
            else:
                resp = await client.get(f"{ollama_url}/api/tags", headers=TUNNEL_HEADERS)
                if resp.status_code == 200:
                    ollama_online = True
                    models = [m.get("name") for m in resp.json().get("models", []) if m.get("name")]
                else:
                    error = f"HTTP {resp.status_code}"
    except Exception as exc:
        error = str(exc)

    return {
        "ollamaOnline": ollama_online,
        "aiMode": "remote-ai-server" if ai_server else "direct-ollama",
        "aiServerUrl": ai_server or None,
        "ollamaUrl": ai_server or ollama_url,
        "configuredModel": configured_model,
        "availableModels": models,
        "allowFallback": settings.ALLOW_FALLBACK,
        "databaseBackend": engine.dialect.name,
        "error": error,
    }
