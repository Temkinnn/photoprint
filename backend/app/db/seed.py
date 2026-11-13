from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine, init_tables
from app.db.models import (
    DBAppState, DBUser, DBMeeting, DBTask,
    DBCalendarSlot, DBAuditLog, DBKPIMetric, DBMeetingInvitation, DBProtocol
)
from app.db.storage import (
    INITIAL_USERS, INITIAL_METRICS,
    INITIAL_SLOTS, INITIAL_TASKS, INITIAL_MEETINGS, INITIAL_AUDIT
)
from app.services.document_store import seed_documents_directory

def seed_database(db: Session = None, force: bool = False):
    init_tables()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE protocols ADD COLUMN IF NOT EXISTS audio_url VARCHAR;"))
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        if force:
            db.query(DBAuditLog).delete()
            db.query(DBMeetingInvitation).delete()
            db.query(DBTask).delete()
            db.query(DBProtocol).delete()
            db.query(DBMeeting).delete()
            db.query(DBCalendarSlot).delete()
            db.query(DBKPIMetric).delete()
            db.query(DBUser).delete()
            db.query(DBAppState).delete()
            db.commit()
            seed_documents_directory(force=True)
        elif db.query(DBUser).first() is not None:
            if db.query(DBAppState).filter(DBAppState.key == "current_role").first() is None:
                db.add(DBAppState(key="current_role", value="ROLE_DIRECTOR"))
                db.commit()
            seed_documents_directory(force=False)
            print("База данных уже инициализирована; документы синхронизированы с папкой documents.")
            return

        print("Сидирование базы данных начальным датасетом ООО «Фотопринт»...")

        db.add(DBAppState(key="current_role", value="ROLE_DIRECTOR"))

        # 1. Пользователи
        for role_key, u in INITIAL_USERS.items():
            db.add(DBUser(
                id=u.id,
                name=u.name,
                role=u.role,
                role_title=u.roleTitle,
                department=u.department,
                avatar_initials=u.avatarInitials
            ))

        # 2. Документы регламентов хранятся в файловой папке documents (не в БД)
        seed_documents_directory(force=force)

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

        # 7. Первичный аудит-лог
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
        print("База данных успешно наполнена.")
    except Exception as e:
        db.rollback()
        print(f"Ошибка при сидировании БД: {e}")
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database()
