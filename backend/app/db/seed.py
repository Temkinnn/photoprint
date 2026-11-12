from sqlalchemy.orm import Session
from app.db.session import SessionLocal, init_tables
from app.db.models import (
    DBUser, DBDocument, DBMeeting, DBTask, 
    DBCalendarSlot, DBAuditLog, DBKPIMetric,
    DBTranscript, DBOverviewBrief
)
from app.db.storage import (
    INITIAL_USERS, INITIAL_DOCUMENTS, INITIAL_METRICS,
    INITIAL_SLOTS, INITIAL_TASKS, INITIAL_MEETINGS, INITIAL_AUDIT,
    INITIAL_TRANSCRIPTS, INITIAL_OVERVIEW_BRIEF
)

def seed_database(db: Session = None):
    init_tables()
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Проверяем, есть ли уже данные
        has_data = False
        try:
            if db.query(DBUser).first() is not None:
                has_data = True
        except Exception:
            has_data = False

        if has_data:
            print("База данных PostgreSQL уже инициализирована. Сидирование пропущено.")
            return

        print("Сидирование PostgreSQL начальным датасетом ООО «Фотопринт»...")

        # 1. Пользователи
        for role_key, u in INITIAL_USERS.items():
            db.add(DBUser(
                id=u.id,
                name=u.name,
                role=u.role,
                role_title=u.roleTitle,
                department=u.department,
                avatar_initials=u.avatarInitials,
                clearance=getattr(u, "clearance", None),
                description=getattr(u, "description", None)
            ))

        # 2. Документы регламентов (16+)
        for doc in INITIAL_DOCUMENTS:
            db.add(DBDocument(
                id=doc.id,
                title=doc.title,
                category=doc.category,
                date=doc.date,
                min_clearance=doc.minClearance,
                summary=doc.summary,
                content=doc.content
            ))

        # 3. KPI Метрики
        for m in INITIAL_METRICS:
            db.add(DBKPIMetric(
                id=m.id,
                name=m.name,
                value=m.value,
                target=m.target,
                status=m.status,
                source_system=m.sourceSystem,
                updated_at=m.updatedAt,
                trend=m.trend
            ))

        # 4. Слоты календаря
        for s in INITIAL_SLOTS:
            db.add(DBCalendarSlot(
                id=s.id,
                start_time=s.startTime,
                end_time=s.endTime,
                date=s.date,
                is_available=s.isAvailable,
                participants_free=s.participantsFree
            ))

        # 5. Задачи
        for t in INITIAL_TASKS:
            db.add(DBTask(
                id=t.id,
                title=t.title,
                assignee_name=t.assigneeName,
                deadline=t.deadline,
                source_quote=t.sourceQuote,
                timestamp=t.timestamp,
                status=t.status,
                meeting_title=t.meetingTitle,
                protocol_id=t.protocolId
            ))

        # 6. Встречи
        for mt in INITIAL_MEETINGS:
            db.add(DBMeeting(
                id=mt.id,
                title=mt.title,
                date=mt.date,
                time=mt.time,
                duration_minutes=mt.durationMinutes,
                participants=mt.participants,
                status=mt.status,
                agenda=mt.agenda,
                open_questions=mt.openQuestions,
                protocol_id=mt.protocolId
            ))

        # 7. Расшифровки встреч (Transcripts)
        for tr in INITIAL_TRANSCRIPTS:
            db.add(DBTranscript(
                id=tr.id,
                title=tr.title,
                date=tr.date,
                type=tr.type,
                content=tr.content,
                summary=tr.summary,
                staged_tasks=[t.model_dump() for t in tr.stagedTasks],
                decisions=[d.model_dump() for d in tr.decisions],
                risks=[r.model_dump() for r in tr.risks]
            ))

        # 8. Сводка Overview
        db.add(DBOverviewBrief(
            id="default",
            situation_brief=INITIAL_OVERVIEW_BRIEF.situationBrief,
            data_freshness=INITIAL_OVERVIEW_BRIEF.dataFreshness,
            critical_issues=[c.model_dump() for c in INITIAL_OVERVIEW_BRIEF.criticalIssues]
        ))

        # 9. Первичный аудит-лог
        for a in INITIAL_AUDIT:
            db.add(DBAuditLog(
                id=a.id,
                timestamp=a.timestamp,
                user_id=a.userId,
                user_name=a.userName,
                user_role=a.userRole,
                action=a.action,
                target_object=a.targetObject,
                status=a.status,
                details=a.details
            ))

        db.commit()
        print("База данных PostgreSQL успешно наполнена эталонными данными.")
    except Exception as e:
        db.rollback()
        print(f"Ошибка при сидировании PostgreSQL: {e}")
        raise
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database()
