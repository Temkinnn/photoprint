import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.config import settings

router = APIRouter(tags=["AI & STT Сервисы"])

class GenerateRequest(BaseModel):
    prompt: str
    system: Optional[str] = "Ты — корпоративный AI-ассистент ООО «Фотопринт»."
    temperature: Optional[float] = 0.2

class AnalyzeTranscriptRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = "Совещание"

@router.post("/stt/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Быстрая транскрибация аудио через Whisper на AI-сервере.
    """
    if not settings.AI_SERVER_URL:
        return {"text": "AI-сервер не настроен", "status": "offline"}

    try:
        content = await file.read()
        headers = {"Bypass-Tunnel-Reminder": settings.AI_SERVER_BYPASS_HEADER}
        files = {"file": (file.filename or "audio.wav", content, file.content_type or "audio/wav")}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVER_URL}/api/v1/stt/transcribe",
                headers=headers,
                files=files
            )
            if resp.status_code == 200:
                return resp.json()
            return {"error": f"Ошибка AI-сервера: HTTP {resp.status_code}", "status": "error"}
    except Exception as e:
        return {"error": str(e), "status": "error"}

@router.post("/ai/analyze-transcript")
async def proxy_analyze_transcript(req: AnalyzeTranscriptRequest):
    """
    Анализ стенограммы встречи через Qwen 2.5 (удаленный AI-сервер или локальная Ollama).
    """
    from app.services.meeting_analyzer import analyze_meeting_transcript
    return await analyze_meeting_transcript(req.transcript, req.meeting_title or "Совещание")

@router.post("/ai/generate")
async def proxy_generate(req: GenerateRequest):
    """
    Прямой запрос к Qwen 2.5 (удаленный AI-сервер или локальная Ollama).
    """
    if settings.AI_SERVER_URL:
        try:
            headers = {"Bypass-Tunnel-Reminder": settings.AI_SERVER_BYPASS_HEADER}
            async with httpx.AsyncClient(timeout=35.0) as client:
                resp = await client.post(
                    f"{settings.AI_SERVER_URL}/api/v1/ai/generate",
                    headers=headers,
                    json={"prompt": req.prompt, "system": req.system, "temperature": req.temperature}
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass

    # Локальная Ollama
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": req.prompt,
                    "system": req.system,
                    "stream": False
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "model": settings.OLLAMA_MODEL,
                    "response": data.get("response", "")
                }
            raise HTTPException(status_code=resp.status_code, detail="Ошибка генерации Ollama")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Локальная Ollama недоступна ({settings.OLLAMA_BASE_URL}): {str(e)}")
