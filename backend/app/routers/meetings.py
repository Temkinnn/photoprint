import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from typing import List, Optional
from app.db.storage import storage
from app.schemas import (
    MeetingItem, CalendarSlot, CreateMeetingRequest,
    ProtocolAnalysisRequest, ProtocolAnalysisResponse,
    ConfirmTasksRequest, TaskItem, TranscriptItem,
    AgendaGenerationRequest, AgendaGenerationResponse
)
from app.services.meeting_analyzer import (
    analyze_meeting_transcript, generate_meeting_agenda, process_audio_meeting,
    generate_word_for_transcript_id
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
async def get_calendar_slots(date: Optional[str] = None, participants: Optional[str] = None):
    """
    Получение слотов календаря с динамической проверкой занятости и коллизий с существующими встречами.
    """
    all_slots = list(storage.slots)
    if date:
        date_slots = [s for s in all_slots if s.date == date]
        if not date_slots:
            date_slots = [
                CalendarSlot(id=f"slot-{date}-1", date=date, startTime="10:00", endTime="11:00", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
                CalendarSlot(id=f"slot-{date}-2", date=date, startTime="11:30", endTime="12:30", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
                CalendarSlot(id=f"slot-{date}-3", date=date, startTime="14:00", endTime="15:00", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
                CalendarSlot(id=f"slot-{date}-4", date=date, startTime="15:30", endTime="16:30", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С."]),
                CalendarSlot(id=f"slot-{date}-5", date=date, startTime="17:00", endTime="18:00", isAvailable=False, participantsFree=["Ковалева Е.Д."]),
            ]

        # Проверка коллизий с запланированными встречами
        existing_for_date = [m for m in storage.meetings if m.date == date and m.status == "scheduled"]
        result_slots = []
        for slot in date_slots:
            has_collision = False
            for m in existing_for_date:
                if m.time and (slot.startTime in m.time or slot.endTime in m.time or m.time.startswith(slot.startTime)):
                    has_collision = True
                    break

            if has_collision:
                result_slots.append(CalendarSlot(
                    id=slot.id,
                    date=slot.date,
                    startTime=slot.startTime,
                    endTime=slot.endTime,
                    isAvailable=False,
                    participantsFree=[]
                ))
            else:
                result_slots.append(slot)
        return result_slots

    return all_slots

@router.delete("/{meeting_id}")
async def delete_meeting(meeting_id: str):
    """
    Отмена и удаление встречи из календаря с освобождением слота.
    """
    meeting_title = meeting_id
    for m in storage.meetings:
        if m.id == meeting_id:
            meeting_title = m.title
            break

    success = storage.delete_meeting(meeting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    storage.add_audit_log(
        action="CANCEL_MEETING_ACTION",
        target=f"{meeting_id} ({meeting_title})",
        status="success",
        details=f"Пользователь отменил встречу «{meeting_title}». Слот в календаре освобожден."
    )
    return {"status": "success", "message": f"Встреча {meeting_id} успешно отменена"}

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

@router.get("/export-word/{transcript_id}")
async def export_word_protocol(transcript_id: str):
    """
    Генерирует и скачивает официальный Word-документ (.docx) протокола встречи со всеми разделами по ТЗ.
    """
    docx_path = generate_word_for_transcript_id(transcript_id)
    if not docx_path or not os.path.exists(docx_path):
        raise HTTPException(status_code=404, detail="Не удалось сгенерировать Word-документ протокола")

    storage.add_audit_log(
        action="EXPORT_WORD_PROTOCOL",
        target=f"Протокол: {transcript_id}",
        status="success",
        details=f"Сгенерирован и скачан Word-документ: {os.path.basename(docx_path)}"
    )
    return FileResponse(
        path=docx_path,
        filename=os.path.basename(docx_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
