import json
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from fastapi import HTTPException
from app.config import settings

TUNNEL_HEADERS = {"Bypass-Tunnel-Reminder": "true"}
_EMBED_HINTS = ("embed", "bge-m3", "nomic-embed", "mxbai-embed", "all-minilm")


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    """Извлекает JSON-объект из ответа модели (включая markdown-блоки ```json)."""
    cleaned = raw_text.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        brace_match = re.search(r"\{[\s\S]*\}", cleaned)
        if brace_match:
            return json.loads(brace_match.group(0))
        raise


def _is_embedding_model(name: str) -> bool:
    lower = name.lower()
    return any(hint in lower for hint in _EMBED_HINTS)


def _pick_chat_model(available_models: List[str], preferred: str) -> Optional[str]:
    chat_models = [m for m in available_models if not _is_embedding_model(m)]
    if not chat_models:
        return None
    pref_lower = (preferred or "").strip().lower()
    for m in chat_models:
        if m.lower() == pref_lower:
            return m
    pref_base = pref_lower.split(":")[0] if pref_lower else ""
    if pref_base:
        for m in chat_models:
            if m.lower().startswith(pref_base):
                return m
    return chat_models[0]


async def probe_local_ollama(timeout: float = 1.5) -> Tuple[bool, bool, List[str], Optional[str], Optional[str]]:
    """
    Проверяет локальную Ollama на OLLAMA_BASE_URL.
    Возвращает (server_reachable, chat_model_ready, all_models, chosen_chat_model, error).
    """
    base_url = (settings.OLLAMA_BASE_URL or "http://localhost:11434").strip().rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(f"{base_url}/api/tags")
        if resp.status_code != 200:
            return False, False, [], None, f"HTTP {resp.status_code}"
        models = [m.get("name") for m in resp.json().get("models", []) if m.get("name")]
        chosen = _pick_chat_model(models, settings.OLLAMA_MODEL)
        return True, chosen is not None, models, chosen, None
    except Exception as exc:
        return False, False, [], None, str(exc)


async def probe_ai_server(
    base_url: str,
    timeout: float = 2.0,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Проверяет доступность сервера ai/server.py (/health)."""
    cleaned = (base_url or "").strip().rstrip("/")
    if not cleaned:
        return False, None, "URL не задан"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(f"{cleaned}/health", headers=TUNNEL_HEADERS)
        if resp.status_code != 200:
            return False, None, f"HTTP {resp.status_code}: {resp.text[:200]}"
        payload = resp.json()
        return payload.get("status") == "online", payload, None
    except Exception as exc:
        return False, None, str(exc)


def _ai_mode() -> str:
    mode = (settings.AI_MODE or "auto").strip().lower()
    return mode if mode in ("auto", "local", "remote") else "auto"


def _build_ai_server_payload(
    messages: List[Dict[str, str]],
    expect_json: bool,
    temperature: float,
) -> Dict[str, Any]:
    system_parts = [m["content"] for m in messages if m.get("role") == "system"]
    user_parts = [m["content"] for m in messages if m.get("role") != "system"]
    system_text = "\n\n".join(system_parts).strip() or "Ты — корпоративный AI-ассистент ООО «Фотопринт»."
    if expect_json:
        system_text += "\n\nВерни СТРОГО один валидный JSON-объект без пояснений до или после него."
    return {
        "prompt": "\n\n".join(user_parts).strip(),
        "system": system_text,
        "temperature": temperature,
    }


async def chat_with_ollama(
    messages: List[Dict[str, str]],
    expect_json: bool = False,
    temperature: float = 0.2,
    timeout: Optional[float] = None,
) -> str:
    """
    Универсальный клиент LLM:
    - AI_MODE=auto (по умолчанию): сначала проверяет локальную Ollama на этом ПК;
      если локальная модель готова — работает локально; иначе пробует локальный ai/server.py
      или удаленный AI_SERVER_URL (для участников без локальных моделей).
    - AI_MODE=local: только локальный контур.
    - AI_MODE=remote: только удаленный AI_SERVER_URL.
    """
    mode = _ai_mode()
    req_timeout = timeout or settings.OLLAMA_TIMEOUT_SECONDS
    ai_server = (settings.AI_SERVER_URL or "").strip().rstrip("/")
    local_ai_server = (settings.LOCAL_AI_SERVER_URL or "").strip().rstrip("/")

    target_kind: Optional[str] = None  # "local-ollama" | "ai-server"
    target_url = ""
    chosen_model = settings.OLLAMA_MODEL

    if mode in ("auto", "local"):
        reachable, model_ready, _, detected_model, _ = await probe_local_ollama()
        if reachable and model_ready and detected_model:
            target_kind = "local-ollama"
            target_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
            chosen_model = detected_model
        elif local_ai_server:
            local_up, _, _ = await probe_ai_server(local_ai_server)
            if local_up:
                target_kind = "ai-server"
                target_url = f"{local_ai_server}/api/v1/ai/generate"

    if target_kind is None and mode in ("auto", "remote") and ai_server:
        target_kind = "ai-server"
        target_url = f"{ai_server}/api/v1/ai/generate"

    if target_kind is None:
        if mode == "remote":
            raise HTTPException(
                status_code=503,
                detail="Режим AI_MODE=remote, но AI_SERVER_URL не задан в backend/.env.",
            )
        raise HTTPException(
            status_code=503,
            detail=(
                f"Локальная Ollama ({settings.OLLAMA_BASE_URL}) с чат-моделью не найдена "
                "и удаленный AI_SERVER_URL недоступен/не задан."
            ),
        )

    if target_kind == "local-ollama":
        payload: Dict[str, Any] = {
            "model": chosen_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if expect_json:
            payload["format"] = "json"
        headers: Dict[str, str] = {}
    else:
        payload = _build_ai_server_payload(messages, expect_json, temperature)
        headers = TUNNEL_HEADERS

    try:
        async with httpx.AsyncClient(timeout=req_timeout, follow_redirects=True) as client:
            resp = await client.post(target_url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Таймаут ожидания ответа от AI ({req_timeout:.0f}с) по адресу {target_url}. "
                "Проверьте нагрузку модели или туннель."
            ),
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Не удалось подключиться к AI по адресу {target_url}: {exc}. "
                "Проверьте локальную Ollama или AI_SERVER_URL в backend/.env."
            ),
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=f"AI ({target_url}) вернул ошибку HTTP {resp.status_code}: {resp.text[:300]}",
        )

    data = resp.json()
    content = (
        data.get("response")
        or data.get("message", {}).get("content")
        or ""
    ).strip()
    if not content:
        raise HTTPException(
            status_code=503,
            detail=f"AI вернул пустой ответ для модели {chosen_model}.",
        )
    return content


def wrap_untrusted_context(text: str) -> str:
    """Оборачивает недоверенный контекст в <untrusted_context> и нейтрализует закрывающие теги."""
    sanitized = re.sub(
        r"</?\s*untrusted_context\b[^>]*>",
        "[untrusted_tag_escaped]",
        text or "",
        flags=re.IGNORECASE,
    )
    return f"<untrusted_context>\n{sanitized}\n</untrusted_context>"
