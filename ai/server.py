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

# Настройка кэша моделей (используем D:\, если диск есть, иначе стандартный кэш или env)
if os.getenv("HF_HOME"):
    os.environ["HF_HOME"] = os.getenv("HF_HOME", "")
elif os.path.exists("D:\\"):
    os.environ["HF_HOME"] = "D:\\huggingface"

WHISPER_DOWNLOAD_ROOT = os.getenv(
    "WHISPER_DOWNLOAD_ROOT",
    "D:\\whisper_models" if os.path.exists("D:\\") else "",
) or None

# Автоподключение CUDA DLL (nvidia-*-cu12, Ollama cuda_v12, CUDA_PATH\bin)
if os.name == "nt":
    cuda_candidates = [
        os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "cublas", "bin"),
        os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "cudnn", "bin"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".venv", "Lib", "site-packages", "nvidia", "cublas", "bin"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".venv", "Lib", "site-packages", "nvidia", "cudnn", "bin"),
        os.path.join(os.getenv("LOCALAPPDATA", ""), "Programs", "Ollama", "lib", "ollama", "cuda_v12"),
        r"C:\Program Files\Ollama\lib\ollama\cuda_v12",
        os.path.join(os.getenv("CUDA_PATH", ""), "bin"),
    ]
    for p in cuda_candidates:
        if p and os.path.isdir(p):
            try:
                os.add_dll_directory(p)
            except OSError:
                pass
            if p not in os.environ.get("PATH", ""):
                os.environ["PATH"] = f"{p}{os.pathsep}{os.environ.get('PATH', '')}"

import numpy as np
import scipy.io.wavfile as wavfile
from openai import AsyncOpenAI

# Инициализация Ollama клиента
OLLAMA_HOST = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
client = AsyncOpenAI(
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
    try:
        import av

        with av.open(audio_path, mode="r") as container:
            resampler = av.audio.resampler.AudioResampler(format="flt", layout="mono", rate=target_sr)
            chunks = []
            for packet in container.demux(audio=0):
                for frame in packet.decode():
                    for out_frame in resampler.resample(frame):
                        chunks.append(np.asarray(out_frame.to_ndarray(), dtype=np.float32).reshape(-1))
            for out_frame in resampler.resample(None):
                chunks.append(np.asarray(out_frame.to_ndarray(), dtype=np.float32).reshape(-1))
        if chunks:
            return np.concatenate(chunks).astype(np.float32, copy=False)
    except Exception:
        pass

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


_WHISPER_CACHE: Dict[str, Any] = {}


def run_whisper(audio_path: str, model_size="medium"):
    import ctranslate2
    from faster_whisper import WhisperModel
    audio_numpy = load_audio_as_numpy(audio_path, target_sr=16000)
    cpu_threads = max(4, (os.cpu_count() or 8) - 2)
    has_cuda = ctranslate2.get_cuda_device_count() > 0

    def try_decode(m_size, device, compute_type):
        key = f"{m_size}:{device}:{compute_type}"
        beam = 5 if device == "cuda" else 2
        m = _WHISPER_CACHE.get(key)
        if m is None:
            kwargs: Dict[str, Any] = {
                "device": device,
                "compute_type": compute_type,
                "cpu_threads": cpu_threads,
            }
            if WHISPER_DOWNLOAD_ROOT:
                kwargs["download_root"] = WHISPER_DOWNLOAD_ROOT
            try:
                m = WhisperModel(m_size, local_files_only=True, **kwargs)
            except Exception:
                m = WhisperModel(m_size, **kwargs)
            _WHISPER_CACHE[key] = m
        segs, _ = m.transcribe(
            audio_numpy,
            beam_size=beam,
            language="ru",
            initial_prompt=CORPORATE_PROMPT,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400)
        )
        seg_list = list(segs)
        if not seg_list:
            segs_nv, _ = m.transcribe(audio_numpy, beam_size=beam, language="ru", initial_prompt=CORPORATE_PROMPT, vad_filter=False)
            seg_list = list(segs_nv)
        return seg_list

    attempts = []
    if has_cuda:
        attempts.extend([(model_size, "cuda", "float16"), (model_size, "cuda", "int8_float16")])
        if model_size != "small":
            attempts.append(("small", "cuda", "float16"))
    if model_size != "small":
        attempts.append(("small", "cpu", "int8"))
    attempts.append((model_size, "cpu", "int8"))

    segments = None
    last_exc = None
    for current_model, device, compute_type in attempts:
        try:
            segments = try_decode(current_model, device, compute_type)
            break
        except Exception as exc:
            last_exc = exc
            _WHISPER_CACHE.pop(f"{current_model}:{device}:{compute_type}", None)
            continue

    if segments is None:
        raise RuntimeError(f"Whisper failed: {last_exc}")

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
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка STT Whisper: {exc}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

class GenerateRequest(BaseModel):
    prompt: str
    system: Optional[str] = "Ты — корпоративный AI-ассистент ООО «Фотопринт»."
    temperature: Optional[float] = 0.2


@app.post("/api/v1/ai/generate")
async def generate_text_endpoint(req: GenerateRequest):
    """Универсальный текстовый вызов Qwen 2.5 для RAG, повестки и редактора документов."""
    try:
        resp = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": req.system or "Ты — корпоративный AI-ассистент ООО «Фотопринт»."},
                {"role": "user", "content": req.prompt},
            ],
            temperature=req.temperature if req.temperature is not None else 0.2,
        )
        return {
            "response": (resp.choices[0].message.content or "").strip(),
            "model": MODEL_NAME,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации LLM: {str(e)}")


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
        resp = await client.chat.completions.create(
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
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки аудио: {exc}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    # Запуск на 0.0.0.0 позволяет любому напарнику в локальной сети подключаться к серверу!
    print("="*60)
    print("  СТАРТ AI & STT СЕРВЕРА ДЛЯ ВСЕЙ КОМАНДЫ (ПОРТ 8001)")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8001)
