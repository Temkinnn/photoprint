import os
import sys
import json
import time
import shutil
import tempfile
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Перенаправляем кэш моделей на диск D:
os.environ["HF_HOME"] = "D:\\huggingface"
WHISPER_DOWNLOAD_ROOT = "D:\\whisper_models"

# Автоподключение CUDA DLL (если есть nvidia-*-cu12)
try:
    site_packages = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".venv", "Lib", "site-packages")
    for nvd in ["cublas", "cudnn"]:
        p = os.path.join(site_packages, "nvidia", nvd, "bin")
        if os.path.exists(p):
            os.add_dll_directory(p)
except Exception:
    pass

import numpy as np
import scipy.io.wavfile as wavfile
from openai import OpenAI

# Инициализация Ollama клиента
OLLAMA_HOST = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
client = OpenAI(
    base_url=f"{OLLAMA_HOST}/v1",
    api_key="ollama"
)
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

CORPORATE_PROMPT = (
    "Оперативное производственное совещание руководства компании ООО «Фотопринт» (сервис picPac.by). "
    "Участники: Генеральный директор Смирнов, начальник производства Иванов, служба снабжения Петрова, служба поддержки Ковалева. "
    "Термины и оборудование: линия УФ-лакировки, ламинатор Foliant Vega 400, перенастройка станка, "
    "матовая бумага 200 грамм, поставщик, предоплата 50%, регламент 30%, лимит, ночная смена на резке, "
    "запасной комплект нагревательных элементов, срыв сроков клиентских заказов, SLA."
)

app = FastAPI(
    title="PhotoPrint AI & STT Server (Developer 2)",
    description="Общий AI-сервер распознавания речи (faster-whisper) и аналитики совещаний (Qwen 2.5) для команды Трека 3",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# МОДЕЛИ ДАННЫХ (SCHEMAS)
# ==========================================
class AnalyzeTranscriptRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = "Оперативное совещание руководства"

class DiarizedLine(BaseModel):
    timestamp: str
    speaker: str
    text: str

class DecisionItem(BaseModel):
    category: str = Field(description="решено, предложено, обсуждалось, требует уточнения")
    text: str
    speaker: Optional[str] = None
    timestamp: str

class TaskItem(BaseModel):
    temp_id: str
    title: str
    assignee: str
    deadline: str
    source_quote: str
    timestamp: str
    status: str = "pending_approval"

class RiskItem(BaseModel):
    risk: str

class OpenQuestionItem(BaseModel):
    question: str

class MeetingAnalysisResult(BaseModel):
    meeting_title: str
    diarized_lines: List[DiarizedLine] = []
    decisions: List[DecisionItem] = []
    tasks: List[TaskItem] = []
    identified_risks: List[RiskItem] = []
    open_questions: List[OpenQuestionItem] = []
    processing_time_sec: float


# ==========================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ STT
# ==========================================
def load_audio_as_numpy(audio_path, target_sr=16000):
    """
    Универсальная загрузка любого аудио (.ogg, .wav, .mp3, .m4a, .flac)
    через PyAV с ресемплингом в 16 кГц моно для Whisper.
    """
    try:
        import av
        container = av.open(audio_path)
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=target_sr)
        frames = []
        for frame in container.decode(audio=0):
            for resampled_frame in resampler.resample(frame):
                frames.append(resampled_frame.to_ndarray())
        if frames:
            return np.concatenate(frames, axis=1).squeeze(0)
    except Exception as e:
        print(f"[!] PyAV decode warning: {e}, fallback to wavfile")

    # Резервный метод для стандартных .wav
    sr, data = wavfile.read(audio_path)
    if len(data.shape) > 1:
        data = data.mean(axis=1)

    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.uint8:
        data = (data.astype(np.float32) - 128.0) / 128.0
    else:
        data = data.astype(np.float32)

    if sr != target_sr:
        from scipy import signal
        num_samples = int(len(data) * target_sr / sr)
        data = signal.resample(data, num_samples)

    return data

def get_whisper_model_path():
    snapshot = r"D:\whisper_models\models--Systran--faster-whisper-medium\snapshots\08e178d48790749d25932bbc082711ddcfdfbc4f"
    if os.path.exists(snapshot):
        return snapshot
    return "medium"

def run_whisper(audio_path: str):
    from faster_whisper import WhisperModel
    audio_numpy = load_audio_as_numpy(audio_path, target_sr=16000)
    model_path = get_whisper_model_path()

    def try_decode(m_path, device, compute_type):
        m = WhisperModel(m_path, device=device, compute_type=compute_type, download_root=WHISPER_DOWNLOAD_ROOT)
        segs, _ = m.transcribe(
            audio_numpy,
            beam_size=5,
            language="ru",
            initial_prompt=CORPORATE_PROMPT,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400)
        )
        return list(segs)

    segments = None
    try:
        segments = try_decode(model_path, "cuda", "float16")
    except Exception as e_cuda:
        print(f"[i] CUDA inference skipped ({e_cuda}), fallback to CPU int8...")
        segments = try_decode(model_path, "cpu", "int8")

    formatted = []
    for s in segments:
        m, sec = int(s.start // 60), int(s.start % 60)
        formatted.append(f"[{m:02d}:{sec:02d}] {s.text.strip()}")

    return "\n".join(formatted), segments


# ==========================================
# ЭНДПОИНТЫ API ДЛЯ ВСЕЙ КОМАНДЫ
# ==========================================

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "PhotoPrint AI Server",
        "ollama_host": OLLAMA_HOST,
        "ollama_model": MODEL_NAME,
        "models_storage": WHISPER_DOWNLOAD_ROOT
    }

@app.post("/api/v1/stt/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """
    Принимает аудиофайл (.wav, .mp3, .m4a) и возвращает расшифровку с таймкодами.
    """
    suffix = os.path.splitext(file.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        t0 = time.time()
        transcript_text, segs = run_whisper(tmp_path)
        elapsed = round(time.time() - t0, 2)
        return {
            "status": "success",
            "filename": file.filename,
            "transcript": transcript_text,
            "segments_count": len(segs),
            "duration_sec": elapsed
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/api/v1/ai/analyze-transcript", response_model=MeetingAnalysisResult)
async def analyze_transcript_endpoint(req: AnalyzeTranscriptRequest):
    """
    Анализирует текст стенограммы: разделяет по спикерам (диаризация),
    выделяет решения (4 статуса), задачи (AI-05 антигаллюцинация) и риски.
    """
    t0 = time.time()
    system_prompt = """
    Ты — ведущий AI-ассистент генерального директора производственной компании ООО «Фотопринт».
    Перед тобой стенограмма совещания с таймкодами.

    1. Выполни диаризацию спикеров (определи говорящего: Директор (Смирнов), Иванов (Нач. производства), Петрова (Снабжение)).
    2. Извлеки решения (категории строго: "решено", "предложено", "обсуждалось", "требует уточнения").
    3. Извлеки задачи (действие, ответственный, срок, цитата, таймкод).
       ПРАВИЛО AI-05: Если ответственный или срок не названы явно — пиши "требует уточнения" (НЕ ВЫДУМЫВАЙ!).
    4. Зафиксируй риски и открытые вопросы.

    Верни валидный JSON:
    {
      "diarized_lines": [{"timestamp": "[00:03]", "speaker": "...", "text": "..."}],
      "decisions": [{"category": "...", "text": "...", "speaker": "...", "timestamp": "..."}],
      "tasks": [{"temp_id": "t1", "title": "...", "assignee": "...", "deadline": "...", "source_quote": "...", "timestamp": "...", "status": "pending_approval"}],
      "identified_risks": [{"risk": "..."}],
      "open_questions": [{"question": "..."}]
    }
    """

    try:
        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Стенограмма:\n{req.transcript}"}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        parsed = json.loads(resp.choices[0].message.content)
        elapsed = round(time.time() - t0, 2)

        return MeetingAnalysisResult(
            meeting_title=req.meeting_title or "Совещание",
            diarized_lines=[DiarizedLine(**d) for d in parsed.get("diarized_lines", [])],
            decisions=[DecisionItem(**d) for d in parsed.get("decisions", [])],
            tasks=[TaskItem(**t) for t in parsed.get("tasks", [])],
            identified_risks=[RiskItem(**r) for r in parsed.get("identified_risks", [])],
            open_questions=[OpenQuestionItem(**q) for q in parsed.get("open_questions", [])],
            processing_time_sec=elapsed
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка AI анализа: {str(e)}")

@app.post("/api/v1/meetings/process-audio", response_model=MeetingAnalysisResult)
async def process_audio_meeting(file: UploadFile = File(...), title: str = Form("Оперативное совещание")):
    """
    Универсальный эндпоинт 'Все-в-одном':
    Принимает аудиофайл -> Whisper -> Qwen 2.5 -> возвращает протокол, диаризацию и задачи!
    """
    suffix = os.path.splitext(file.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        t0 = time.time()
        transcript_text, _ = run_whisper(tmp_path)
        req = AnalyzeTranscriptRequest(transcript=transcript_text, meeting_title=title)
        res = await analyze_transcript_endpoint(req)
        res.processing_time_sec = round(time.time() - t0, 2)
        return res
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

class GenerateRequest(BaseModel):
    prompt: str
    system: Optional[str] = "Ты — корпоративный AI-ассистент ООО «Фотопринт»."
    temperature: Optional[float] = 0.2

@app.post("/api/v1/ai/generate")
async def generate_text_endpoint(req: GenerateRequest):
    """
    Универсальный эндпоинт генерации текста (Qwen 2.5 7B) для RAG и чата с базой знаний.
    """
    try:
        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": req.system},
                {"role": "user", "content": req.prompt}
            ],
            temperature=req.temperature or 0.2
        )
        return {
            "status": "success",
            "model": MODEL_NAME,
            "response": resp.choices[0].message.content.strip()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации Ollama: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Запуск на 0.0.0.0 позволяет любому напарнику в локальной сети подключаться к серверу!
    print("="*60)
    print("  СТАРТ AI & STT СЕРВЕРА ДЛЯ ВСЕЙ КОМАНДЫ (ПОРТ 8001)")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8001)
