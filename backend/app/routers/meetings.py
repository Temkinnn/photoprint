import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.db.models import DBCalendarSlot, DBMeeting, DBMeetingInvitation, DBProtocol, DBTask, DBUser
from app.db.session import get_db
from app.db.storage import EXTRA_STAFF
from app.schemas import (
    AudioTranscriptionResponse,
    CalendarSlot,
    ConfirmTasksRequest,
    CreateMeetingRequest,
    DecisionItem,
    MeetingInvitationItem,
    MeetingItem,
    PrepareAgendaRequest,
    PrepareAgendaResponse,
    ProtocolAnalysisRequest,
    ProtocolAnalysisResponse,
    ProtocolItem,
    RespondInvitationRequest,
    RiskItem,
    SaveProtocolRequest,
    TaskItem,
)
from app.services.audit import add_audit_log, get_active_user, resolve_authorized_user, surname_key
from app.services.meeting_analyzer import (
    analyze_meeting_transcript,
    extract_transcript_text,
    process_meeting_audio,
    transcribe_meeting_audio,
)
from app.services.meeting_prep import generate_meeting_prep

router = APIRouter(prefix="/meetings", tags=["Встречи и Протоколы"])


def _to_meeting_item(m: DBMeeting) -> MeetingItem:
    return MeetingItem(
        id=m.id,
        title=m.title,
        date=m.date,
        time=m.time,
        durationMinutes=m.duration_minutes,
        participants=m.participants or [],
        status=m.status,
        agenda=m.agenda or [],
        openQuestions=m.open_questions or [],
        protocolId=m.protocol_id,
    )


def _to_invitation_item(inv: DBMeetingInvitation) -> MeetingInvitationItem:
    return MeetingInvitationItem(
        id=inv.id,
        meetingId=inv.meeting_id,
        meetingTitle=inv.meeting_title,
        date=inv.date,
        time=inv.time,
        organizerName=inv.organizer_name,
        recipientId=inv.recipient_id,
        recipientName=inv.recipient_name,
        recipientRole=inv.recipient_role,
        agenda=inv.agenda or [],
        messageText=inv.message_text,
        status=inv.status,
        createdAt=inv.created_at,
    )


def _to_protocol_item(p: DBProtocol) -> ProtocolItem:
    return ProtocolItem(
        id=p.id,
        meetingId=p.meeting_id,
        meetingTitle=p.meeting_title,
        transcriptRef=p.transcript_ref,
        transcriptText=p.transcript_text or "",
        summary=p.summary,
        decisions=[DecisionItem(**d) for d in (p.decisions or [])],
        risks=[RiskItem(**r) for r in (p.risks or [])],
        openQuestions=p.open_questions or [],
        processingTimeSec=p.processing_time_sec,
        createdAt=p.created_at,
        createdBy=p.created_by,
    )


@router.get("/", response_model=List[MeetingItem])
async def get_meetings(db: Session = Depends(get_db)):
    rows = db.query(DBMeeting).all()
    items = [_to_meeting_item(m) for m in reversed(rows)]
    # Ставим запланированные новые встречи выше архивных
    items.sort(key=lambda m: 0 if m.status == "scheduled" else 1)
    return items


@router.get("/calendar/slots", response_model=List[CalendarSlot])
async def get_calendar_slots(db: Session = Depends(get_db)):
    rows = db.query(DBCalendarSlot).order_by(DBCalendarSlot.id.asc()).all()
    return [
        CalendarSlot(
            id=s.id,
            startTime=s.start_time,
            endTime=s.end_time,
            date=s.date,
            isAvailable=s.is_available,
            participantsFree=s.participants_free or [],
        )
        for s in rows
    ]


@router.post("/prepare-agenda", response_model=PrepareAgendaResponse)
async def prepare_agenda(req: PrepareAgendaRequest, db: Session = Depends(get_db)):
    current_user = resolve_authorized_user(db, req.userRole, "MEETING_PREP")
    return await generate_meeting_prep(db, req, current_user)


@router.post("/create", response_model=MeetingItem)
async def create_meeting(req: CreateMeetingRequest, db: Session = Depends(get_db)):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Название встречи не может быть пустым.")
    if not req.participants:
        raise HTTPException(status_code=400, detail="Выберите хотя бы одного участника встречи.")

    # 1. Бронирование слота в календаре (AI-03: фиксируется только при явном подтверждении)
    if req.slotId:
        slot = db.query(DBCalendarSlot).filter(DBCalendarSlot.id == req.slotId).first()
        if not slot:
            raise HTTPException(status_code=404, detail="Выбранный временной слот не найден.")
        if not slot.is_available:
            raise HTTPException(
                status_code=409,
                detail=f"Слот {slot.date} {slot.start_time}–{slot.end_time} уже занят.",
            )
        slot.is_available = False

    # 2. Сохранение встречи в PostgreSQL
    meeting_id = f"m-sched-{uuid.uuid4().hex[:6]}"
    db_meeting = DBMeeting(
        id=meeting_id,
        title=req.title.strip(),
        date=req.date,
        time=req.time,
        duration_minutes=req.durationMinutes,
        participants=req.participants,
        status="scheduled",
        agenda=req.agenda,
        open_questions=req.openQuestions or [],
    )
    db.add(db_meeting)

    # 3. Рассылка приглашений участникам (кроме организатора)
    organizer = get_active_user(db)
    organizer_surname = surname_key(organizer.name)
    system_users_by_surname = {surname_key(u.name): u for u in db.query(DBUser).all()}
    extra_by_surname = {surname_key(st["name"]): st for st in EXTRA_STAFF}

    agenda_preview = "\n".join(f"• {a}" for a in req.agenda) if req.agenda else "• Уточняется на встрече"
    default_msg = (
        f"Приглашение на совещание «{req.title.strip()}».\n"
        f"Дата и время: {req.date}, {req.time}.\n"
        f"Повестка:\n{agenda_preview}"
    )
    message_text = (req.invitationText or "").strip() or default_msg
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    created_invitations = []
    for raw_participant in req.participants:
        p_surname = surname_key(raw_participant)
        if not p_surname or p_surname == organizer_surname:
            continue

        sys_user = system_users_by_surname.get(p_surname)
        extra_user = extra_by_surname.get(p_surname)
        recipient_id = sys_user.id if sys_user else (extra_user["id"] if extra_user else f"ext-{p_surname}")
        recipient_name = sys_user.name if sys_user else (extra_user["name"] if extra_user else raw_participant)
        recipient_role = sys_user.role if sys_user else None

        inv = DBMeetingInvitation(
            id=f"inv-{uuid.uuid4().hex[:8]}",
            meeting_id=meeting_id,
            meeting_title=req.title.strip(),
            date=req.date,
            time=req.time,
            organizer_name=organizer.name,
            recipient_id=recipient_id,
            recipient_name=recipient_name,
            recipient_role=recipient_role,
            agenda=req.agenda,
            message_text=message_text,
            status="pending",
            created_at=now_str,
        )
        db.add(inv)
        created_invitations.append(recipient_name)

    db.commit()
    db.refresh(db_meeting)

    add_audit_log(
        db,
        action="CREATE_MEETING_CONFIRMED",
        target=f"{db_meeting.id} ({db_meeting.title})",
        status="success",
        details=(
            f"Пользователь явно подтвердил создание совещания на {db_meeting.date} {db_meeting.time}. "
            f"Слот календаря ({req.slotId or 'вручную'}) помечен занятым."
        ),
        user=organizer,
    )

    if created_invitations:
        add_audit_log(
            db,
            action="SEND_MEETING_INVITATIONS",
            target=f"{db_meeting.id} ({len(created_invitations)} получателей)",
            status="success",
            details=f"Отправлены подтвержденные приглашения участникам: {', '.join(created_invitations)}",
            user=organizer,
        )

    return _to_meeting_item(db_meeting)


@router.get("/invitations", response_model=List[MeetingInvitationItem])
async def get_invitations(
    recipient_role: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(DBMeetingInvitation)
    if recipient_role:
        query = query.filter(DBMeetingInvitation.recipient_role == recipient_role)
    rows = query.order_by(DBMeetingInvitation.created_at.desc()).all()
    return [_to_invitation_item(inv) for inv in rows]


@router.post("/invitations/{inv_id}/respond", response_model=MeetingInvitationItem)
async def respond_invitation(
    inv_id: str,
    req: RespondInvitationRequest,
    db: Session = Depends(get_db),
):
    inv = db.query(DBMeetingInvitation).filter(DBMeetingInvitation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Приглашение не найдено.")

    inv.status = req.status
    db.commit()
    db.refresh(inv)

    status_label = "принято" if req.status == "accepted" else "отклонено"
    add_audit_log(
        db,
        action="RESPOND_INVITATION",
        target=f"{inv.id} ({inv.meeting_title})",
        status="success" if req.status == "accepted" else "warning",
        details=f"Приглашение для {inv.recipient_name} {status_label}.",
    )
    return _to_invitation_item(inv)


@router.get("/protocols", response_model=List[ProtocolItem])
async def get_protocols(db: Session = Depends(get_db)):
    rows = db.query(DBProtocol).all()
    return [_to_protocol_item(p) for p in reversed(rows)]


@router.get("/protocols/{protocol_id}", response_model=ProtocolItem)
async def get_protocol_by_id(protocol_id: str, db: Session = Depends(get_db)):
    row = db.query(DBProtocol).filter(DBProtocol.id == protocol_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Протокол не найден.")
    return _to_protocol_item(row)


@router.post("/save-protocol", response_model=ProtocolItem)
async def save_protocol(req: SaveProtocolRequest, db: Session = Depends(get_db)):
    """Сохраняет протокол в PostgreSQL и привязывает его ко встрече (если указана)."""
    current_user = get_active_user(db)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    existing = None
    if req.meetingId:
        existing = db.query(DBProtocol).filter(DBProtocol.meeting_id == req.meetingId).first()

    if existing:
        existing.meeting_title = req.meetingTitle
        existing.transcript_ref = req.transcriptRef
        existing.transcript_text = req.transcriptText
        existing.summary = req.summary
        existing.decisions = [d.model_dump() for d in req.decisions]
        existing.risks = [r.model_dump() for r in req.risks]
        existing.open_questions = req.openQuestions
        existing.processing_time_sec = req.processingTimeSec
        existing.created_at = now_str
        existing.created_by = current_user.name
        db_proto = existing
    else:
        db_proto = DBProtocol(
            id=f"prot-{uuid.uuid4().hex[:6]}",
            meeting_id=req.meetingId,
            meeting_title=req.meetingTitle,
            transcript_ref=req.transcriptRef,
            transcript_text=req.transcriptText,
            summary=req.summary,
            decisions=[d.model_dump() for d in req.decisions],
            risks=[r.model_dump() for r in req.risks],
            open_questions=req.openQuestions,
            processing_time_sec=req.processingTimeSec,
            created_at=now_str,
            created_by=current_user.name,
        )
        db.add(db_proto)

    db.flush()

    if req.meetingId:
        db_meeting = db.query(DBMeeting).filter(DBMeeting.id == req.meetingId).first()
        if db_meeting:
            db_meeting.protocol_id = db_proto.id
            db_meeting.status = "completed"
            if req.openQuestions:
                db_meeting.open_questions = req.openQuestions

    db.commit()
    db.refresh(db_proto)

    add_audit_log(
        db,
        action="SAVE_PROTOCOL",
        target=f"{db_proto.id} ({db_proto.meeting_title})",
        status="success",
        details=(
            f"Протокол сохранён в PostgreSQL ({db_proto.transcript_ref}): "
            f"решений — {len(req.decisions)}, рисков — {len(req.risks)}"
        ),
        user=current_user,
    )
    return _to_protocol_item(db_proto)


@router.post("/transcribe-audio", response_model=AudioTranscriptionResponse)
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    meetingTitle: str = Form("Оперативное совещание"),
    meetingId: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Только транскрибация аудио через Whisper (без запуска Qwen) для фонового режима."""
    file_bytes = await file.read()
    title = (meetingTitle or "").strip() or (file.filename or "Оперативное совещание")
    try:
        result = await transcribe_meeting_audio(
            file_bytes=file_bytes,
            filename=file.filename or "meeting.ogg",
            meeting_title=title,
            meeting_id=meetingId,
            content_type=file.content_type or "application/octet-stream",
        )
    except HTTPException as exc:
        add_audit_log(
            db,
            action="TRANSCRIBE_MEETING_AUDIO",
            target=f"{title} ({file.filename})",
            status="warning",
            details=f"Ошибка транскрибации Whisper: {exc.detail}",
        )
        raise

    add_audit_log(
        db,
        action="TRANSCRIBE_MEETING_AUDIO",
        target=f"{title} ({file.filename})",
        status="success",
        details=(
            f"Аудиозапись расшифрована Whisper ({result.durationSec or 0}с) и ожидает запуска AI-анализа"
            + (f" [встреча {meetingId}]" if meetingId else "")
        ),
    )
    return result


@router.post("/process-audio", response_model=ProtocolAnalysisResponse)
async def process_audio_endpoint(
    file: UploadFile = File(...),
    meetingTitle: str = Form("Оперативное совещание"),
    meetingId: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    title = (meetingTitle or "").strip() or (file.filename or "Оперативное совещание")
    try:
        result = await process_meeting_audio(
            file_bytes=file_bytes,
            filename=file.filename or "meeting.ogg",
            meeting_title=title,
            content_type=file.content_type or "application/octet-stream",
        )
    except HTTPException as exc:
        add_audit_log(
            db,
            action="PROCESS_MEETING_AUDIO",
            target=f"{title} ({file.filename})",
            status="warning",
            details=f"Ошибка обработки аудиозаписи через Whisper/AI: {exc.detail}",
        )
        raise

    add_audit_log(
        db,
        action="PROCESS_MEETING_AUDIO",
        target=f"{title} ({file.filename})",
        status="success",
        details=(
            f"Аудиозапись расшифрована (Whisper + Qwen 2.5): решений — {len(result.decisions)}, "
            f"поручений — {len(result.tasks)}, рисков — {len(result.risks)}"
            + (f" [встреча {meetingId}]" if meetingId else "")
        ),
    )
    return result


@router.post("/upload-transcript", response_model=ProtocolAnalysisResponse)
async def upload_transcript_endpoint(
    file: UploadFile = File(...),
    meetingTitle: str = Form("Оперативное совещание"),
    meetingId: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    transcript_text = extract_transcript_text(file_bytes, file.filename or "transcript.txt")
    title = (meetingTitle or "").strip() or (file.filename or "Оперативное совещание")
    try:
        result = await analyze_meeting_transcript(transcript_text, title)
    except HTTPException as exc:
        add_audit_log(
            db,
            action="UPLOAD_AND_ANALYZE_TRANSCRIPT",
            target=f"{title} ({file.filename})",
            status="warning",
            details=f"Ошибка анализа загруженной стенограммы: {exc.detail}",
        )
        raise

    add_audit_log(
        db,
        action="UPLOAD_AND_ANALYZE_TRANSCRIPT",
        target=f"{title} ({file.filename})",
        status="success",
        details=(
            f"Загружен файл стенограммы ({file.filename}): решений — {len(result.decisions)}, "
            f"поручений — {len(result.tasks)}"
            + (f" [встреча {meetingId}]" if meetingId else "")
        ),
    )
    return result


@router.post("/analyze-transcript", response_model=ProtocolAnalysisResponse)
async def analyze_transcript(req: ProtocolAnalysisRequest, db: Session = Depends(get_db)):
    try:
        result = await analyze_meeting_transcript(req.transcriptText, req.meetingTitle)
    except HTTPException as exc:
        add_audit_log(
            db,
            action="ANALYZE_TRANSCRIPT",
            target=req.meetingTitle,
            status="warning",
            details=f"Ошибка AI-анализа стенограммы: {exc.detail}",
        )
        raise

    add_audit_log(
        db,
        action="ANALYZE_TRANSCRIPT",
        target=req.meetingTitle,
        status="success",
        details=(
            f"Стенограмма проанализирована AI-моделью ({result.modelUsed or 'Qwen 2.5'}): "
            f"решений — {len(result.decisions)}, поручений — {len(result.tasks)}"
            + (f" [встреча {req.meetingId}]" if req.meetingId else "")
        ),
    )
    return result


@router.post("/confirm-tasks", response_model=List[TaskItem])
async def confirm_tasks(req: ConfirmTasksRequest, db: Session = Depends(get_db)):
    """Human-in-the-Loop: подтверждение руководителем списка задач из протокола в PostgreSQL."""
    added_tasks: List[TaskItem] = []
    for t in req.tasks:
        new_id = f"task-{uuid.uuid4().hex[:6]}"
        assignee = (t.assigneeName or "").strip() or "Требует уточнения"
        deadline = (t.deadline or "").strip() or "Требует уточнения"
        meeting_title = req.meetingTitle or t.meetingTitle

        db_task = DBTask(
            id=new_id,
            title=t.title,
            assignee_name=assignee,
            deadline=deadline,
            source_quote=t.sourceQuote,
            timestamp=t.timestamp,
            status="active",
            meeting_title=meeting_title,
            protocol_id=req.protocolId or t.protocolId,
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)

        confirmed_task = TaskItem(
            id=db_task.id,
            title=db_task.title,
            assigneeName=db_task.assignee_name,
            deadline=db_task.deadline,
            sourceQuote=db_task.source_quote,
            timestamp=db_task.timestamp,
            status=db_task.status,
            meetingTitle=db_task.meeting_title,
            protocolId=db_task.protocol_id,
        )
        added_tasks.append(confirmed_task)

        add_audit_log(
            db,
            action="CONFIRM_TASK_ACTION",
            target=f"{confirmed_task.id} ({confirmed_task.title})",
            status="success",
            details=f"Руководитель согласовал задачу для исполнителя '{confirmed_task.assigneeName}' со сроком '{confirmed_task.deadline}'",
        )

    return added_tasks
