import importlib.util
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config import settings
from app.db.seed import seed_database
from app.db.session import engine, get_db
from app.services.audit import add_audit_log
from app.services.ollama_client import probe_ai_server, probe_local_ollama

router = APIRouter(prefix="/system", tags=["Системные операции"])


@router.post("/reset-demo")
async def reset_demo_state(db: Session = Depends(get_db)):
    """Сброс состояния БД и папки documents к эталону для жюри."""
    seed_database(db=db, force=True)
    add_audit_log(
        db,
        action="DEMO_RESET",
        target="PostgreSQL + папка documents",
        status="success",
        details="Состояние системы, документы в папке documents, слоты, приглашения и аудит сброшены к эталону",
    )
    return {
        "status": "success",
        "message": "Демо-стенд сброшен к исходному состоянию",
    }


@router.get("/ai-status")
async def get_ai_status():
    """Автоматическая диагностика локальных нейронок (Ollama + Whisper) и удаленного AI_SERVER_URL."""
    mode = (settings.AI_MODE or "auto").strip().lower()
    ai_server = (settings.AI_SERVER_URL or "").strip().rstrip("/")
    local_ai_server = (settings.LOCAL_AI_SERVER_URL or "").strip().rstrip("/")
    ollama_url = settings.OLLAMA_BASE_URL.rstrip("/")

    whisper_pkg_installed = importlib.util.find_spec("faster_whisper") is not None

    ollama_reachable = False
    local_chat_ready = False
    local_models = []
    chosen_local_model = None
    local_error = None

    if mode in ("auto", "local"):
        ollama_reachable, local_chat_ready, local_models, chosen_local_model, local_error = await probe_local_ollama()

    local_srv_up = False
    local_srv_payload = None
    if mode in ("auto", "local") and local_ai_server:
        local_srv_up, local_srv_payload, _ = await probe_ai_server(local_ai_server)

    remote_srv_up = False
    remote_srv_payload = None
    remote_error = None
    if mode in ("auto", "remote") and ai_server:
        remote_srv_up, remote_srv_payload, remote_error = await probe_ai_server(ai_server)

    if mode in ("auto", "local") and local_chat_ready and chosen_local_model:
        active_mode = "local-ollama"
        ollama_online = True
        active_url = ollama_url
        configured_model = chosen_local_model
        available_models = local_models
        error = None
    elif mode in ("auto", "local") and local_srv_up and local_srv_payload:
        active_mode = "local-ai-server"
        ollama_online = True
        active_url = local_ai_server
        configured_model = local_srv_payload.get("ollama_model", settings.OLLAMA_MODEL)
        available_models = [configured_model]
        error = None
    elif mode in ("auto", "remote") and remote_srv_up and remote_srv_payload:
        active_mode = "remote-ai-server"
        ollama_online = True
        active_url = ai_server
        configured_model = remote_srv_payload.get("ollama_model", settings.OLLAMA_MODEL)
        available_models = [configured_model]
        error = None
    else:
        active_mode = "offline"
        ollama_online = False
        active_url = ollama_url if mode == "local" else (ai_server or ollama_url)
        configured_model = settings.OLLAMA_MODEL
        available_models = local_models
        if ollama_reachable and not local_chat_ready:
            error = (
                f"Локальная Ollama запущена, но чат-модель {settings.OLLAMA_MODEL} еще не скачана "
                f"(доступно: {', '.join(local_models) or 'пусто'})."
            )
        else:
            error = remote_error or local_error or "Ни локальный, ни удаленный AI-сервер не отвечают."

    return {
        "ollamaOnline": ollama_online,
        "aiMode": active_mode,
        "configuredAiMode": mode,
        "aiServerUrl": ai_server or None,
        "ollamaUrl": active_url,
        "configuredModel": configured_model,
        "availableModels": available_models,
        "localOllamaOnline": local_chat_ready,
        "localServerOnline": local_srv_up,
        "remoteServerOnline": remote_srv_up,
        "whisperLocalAvailable": whisper_pkg_installed or local_srv_up,
        "allowFallback": settings.ALLOW_FALLBACK,
        "databaseBackend": engine.dialect.name,
        "error": error,
    }
