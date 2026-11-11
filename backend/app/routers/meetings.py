from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List
from app.db.storage import storage
from app.schemas import (
    MeetingItem, CalendarSlot, CreateMeetingRequest,
    ProtocolAnalysisRequest, ProtocolAnalysisResponse,
    ConfirmTasksRequest, TaskItem, TranscriptItem,
    AgendaGenerationRequest, AgendaGenerationResponse
)
from app.services.meeting_analyzer import (
    analyze_meeting_transcript, generate_meeting_agenda, process_audio_meeting
)

router = APIRouter(prefix="/meetings", tags=["Встречи и Протоколы"])

@router.get("/", response_model=List[MeetingItem])
async def get_meetings():
    return storage.meetings

@router.get("/transcripts", response_model=List[TranscriptItem])
async def get_transcripts():
    return storage.transcripts

@router.get("/transcripts/{transcript_id}", response_model=TranscriptItem)
async def get_transcript(transcript_id: str):
    for t in storage.transcripts:
        if t.id == transcript_id:
            return t
    raise HTTPException(status_code=404, detail="Стенограмма не найдена")

@router.post("/generate-agenda", response_model=AgendaGenerationResponse)
async def api_generate_agenda(req: AgendaGenerationRequest):
    storage.add_audit_log(
        action="GENERATE_AGENDA",
        target=f"Тема: {req.topic}",
        status="success",
        details="Генерация проекта повестки и вопросов локальным AI-модулем на основе регламентов"
    )
    return await generate_meeting_agenda(req.topic, req.participants, req.documents)

@router.get("/calendar/slots", response_model=List[CalendarSlot])
async def get_calendar_slots():
    return storage.slots

@router.post("/create", response_model=MeetingItem)
async def create_meeting(req: CreateMeetingRequest):
    new_meeting = MeetingItem(
        id=f"m-{len(storage.meetings) + 1}",
        title=req.title,
        date=req.date,
        time=req.time,
        durationMinutes=req.durationMinutes,
        participants=req.participants,
        status="scheduled",
        agenda=req.agenda,
        openQuestions=[]
    )
    storage.meetings.insert(0, new_meeting)
    storage.add_audit_log(
        action="CREATE_MEETING_CONFIRMED",
        target=f"{new_meeting.id} ({new_meeting.title})",
        status="success",
        details=f"Пользователь явно подтвердил создание совещания на {new_meeting.date} {new_meeting.time}"
    )
    return new_meeting

@router.post("/analyze-transcript", response_model=ProtocolAnalysisResponse)
async def analyze_transcript(req: ProtocolAnalysisRequest):
    storage.add_audit_log(
        action="ANALYZE_TRANSCRIPT",
        target=req.meetingTitle,
        status="success",
        details="Запущен автоматический анализ стенограммы встречи локальной AI-моделью"
    )
    return await analyze_meeting_transcript(req.transcriptText, req.meetingTitle)

@router.post("/process-audio", response_model=ProtocolAnalysisResponse)
async def process_audio(
    file: UploadFile = File(...),
    title: str = Form("Оперативное совещание")
):
    """
    Универсальный эндпоинт обработки аудиозаписи встречи:
    Загрузка аудио (.wav, .ogg, .mp3) -> Whisper STT -> Qwen 2.5 -> сохранение в БД -> протокол и задачи.
    """
    file_bytes = await file.read()
    analysis_resp, new_transcript = await process_audio_meeting(
        file_bytes=file_bytes,
        filename=file.filename or "audio.wav",
        meeting_title=title
    )
    # Сохранение созданной расшифровки в PostgreSQL
    storage.add_transcript(new_transcript)
    storage.add_audit_log(
        action="PROCESS_AUDIO_MEETING",
        target=f"{new_transcript.id} ({new_transcript.title})",
        status="success",
        details=f"Аудиозапись '{file.filename}' расшифрована (Whisper) и извлечены поручения (Qwen 2.5)"
    )
    return analysis_resp

@router.post("/confirm-tasks", response_model=List[TaskItem])
async def confirm_tasks(req: ConfirmTasksRequest):
    """
    Human-in-the-Loop: подтверждение руководителем списка задач из протокола в общий реестр.
    """
    added_tasks = []
    for t in req.tasks:
        confirmed_task = TaskItem(
            id=f"task-{len(storage.tasks) + 1}",
            title=t.title,
            assigneeName=t.assigneeName if t.assigneeName != "Требует уточнения" else "Не назначен",
            deadline=t.deadline if t.deadline != "Требует уточнения" else "Не установлен",
            sourceQuote=t.sourceQuote,
            timestamp=t.timestamp,
            status="active",
            meetingTitle=req.meetingTitle or t.meetingTitle
        )
        storage.tasks.insert(0, confirmed_task)
        added_tasks.append(confirmed_task)
        
        storage.add_audit_log(
            action="CONFIRM_TASK_ACTION",
            target=f"{confirmed_task.id} ({confirmed_task.title})",
            status="success",
            details=f"Руководитель согласовал задачу для исполнителя '{confirmed_task.assigneeName}' со сроком '{confirmed_task.deadline}'"
        )

    return added_tasks
