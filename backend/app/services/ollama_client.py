import json
import re
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException
from app.config import settings

TUNNEL_HEADERS = {"Bypass-Tunnel-Reminder": "true"}


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


async def chat_with_ollama(
    messages: List[Dict[str, str]],
    expect_json: bool = False,
    temperature: float = 0.2,
    timeout: Optional[float] = None,
) -> str:
    """
    Универсальный клиент LLM:
    1. Если задан AI_SERVER_URL (например, туннель loca.lt друга с ai/server.py),
       вызывает POST {AI_SERVER_URL}/api/v1/ai/generate с заголовком Bypass-Tunnel-Reminder.
    2. Иначе обращается напрямую к Ollama {OLLAMA_BASE_URL}/api/chat.
    """
    ai_server = (settings.AI_SERVER_URL or "").strip().rstrip("/")
    req_timeout = timeout or settings.OLLAMA_TIMEOUT_SECONDS

    if ai_server:
        target_url = f"{ai_server}/api/v1/ai/generate"
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        user_parts = [m["content"] for m in messages if m.get("role") != "system"]
        system_text = "\n\n".join(system_parts).strip() or "Ты — корпоративный AI-ассистент ООО «Фотопринт»."
        if expect_json:
            system_text += "\n\nВерни СТРОГО один валидный JSON-объект без пояснений до или после него."
        payload: Dict[str, Any] = {
            "prompt": "\n\n".join(user_parts).strip(),
            "system": system_text,
            "temperature": temperature,
        }
    else:
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        target_url = f"{base_url}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if expect_json:
            payload["format"] = "json"

    try:
        async with httpx.AsyncClient(timeout=req_timeout, follow_redirects=True) as client:
            resp = await client.post(target_url, json=payload, headers=TUNNEL_HEADERS)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Таймаут ожидания ответа от AI-сервера ({req_timeout:.0f}с) по адресу {target_url}. "
                "Проверьте работу туннеля и AI-сервера у хоста."
            ),
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Не удалось подключиться к AI по адресу {target_url}: {exc}. "
                "Проверьте AI_SERVER_URL / OLLAMA_BASE_URL в backend/.env и работу туннеля."
            ),
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=f"AI-сервер ({target_url}) вернул ошибку HTTP {resp.status_code}: {resp.text[:300]}",
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
            detail=f"AI-сервер вернул пустой ответ для модели {settings.OLLAMA_MODEL}.",
        )
    return content
