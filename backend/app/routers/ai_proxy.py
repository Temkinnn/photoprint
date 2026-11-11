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
    Анализ стенограммы встречи через Qwen 2.5 на AI-сервере.
    """
    if not settings.AI_SERVER_URL:
        raise HTTPException(status_code=503, detail="AI-сервер не настроен")

    try:
        headers = {"Bypass-Tunnel-Reminder": settings.AI_SERVER_BYPASS_HEADER}
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVER_URL}/api/v1/ai/analyze-transcript",
                headers=headers,
                json={"transcript": req.transcript, "meeting_title": req.meeting_title}
            )
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(status_code=resp.status_code, detail="Ошибка обработки на AI-сервере")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"AI-сервер недоступен: {str(e)}")

@router.post("/ai/generate")
async def proxy_generate(req: GenerateRequest):
    """
    Прямой запрос к Qwen 2.5 на AI-сервере для ответов и генерации текста.
    """
    if not settings.AI_SERVER_URL:
        raise HTTPException(status_code=503, detail="AI-сервер не настроен")

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
            raise HTTPException(status_code=resp.status_code, detail="Ошибка генерации на AI-сервере")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"AI-сервер недоступен: {str(e)}")
