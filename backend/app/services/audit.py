import uuid
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.db.models import DBAppState, DBAuditLog, DBUser
from app.db.storage import INITIAL_USERS
from app.schemas import UserProfile, UserRole


def get_role_clearance(role: UserRole) -> int:
    """
    1 = Директор (видит всё)
    2 = Руководитель производства (производство + сервис, без финансов)
    3 = Руководитель поддержки / Общие сотрудники (только сервис и общие регламенты)
    """
    if role == "ROLE_DIRECTOR":
        return 1
    if role == "ROLE_PRODUCTION_HEAD":
        return 2
    return 3


def surname_key(name: str) -> str:
    """Нормализация ФИО по фамилии для сопоставления 'Смирнов Алексей Викторович' и 'Смирнов А.В.'."""
    cleaned = (name or "").split("(")[0].strip()
    parts = cleaned.split()
    return parts[0].lower() if parts else ""


def _user_from_db(db_user: DBUser) -> UserProfile:
    return UserProfile(
        id=db_user.id,
        name=db_user.name,
        role=db_user.role,
        roleTitle=db_user.role_title,
        department=db_user.department,
        avatarInitials=db_user.avatar_initials,
    )


def get_active_user(db: Session, override_role: Optional[UserRole] = None) -> UserProfile:
    role: UserRole = override_role  # type: ignore[assignment]
    if not role:
        state = db.query(DBAppState).filter(DBAppState.key == "current_role").first()
        role = (state.value if state else "ROLE_DIRECTOR")  # type: ignore[assignment]

    db_user = db.query(DBUser).filter(DBUser.role == role).first()
    if db_user:
        return _user_from_db(db_user)
    return INITIAL_USERS.get(role, INITIAL_USERS["ROLE_DIRECTOR"])


def switch_active_role(db: Session, role: UserRole) -> UserProfile:
    state = db.query(DBAppState).filter(DBAppState.key == "current_role").first()
    if state:
        state.value = role
    else:
        db.add(DBAppState(key="current_role", value=role))
    db.commit()
    return get_active_user(db, role)


def add_audit_log(
    db: Session,
    action: str,
    target: str,
    status: str,
    details: str,
    user: Optional[UserProfile] = None,
) -> DBAuditLog:
    active_user = user or get_active_user(db)
    entry = DBAuditLog(
        id=f"aud-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        user_id=active_user.id,
        user_name=active_user.name,
        user_role=active_user.role,
        action=action,
        target_object=target,
        status=status,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def resolve_authorized_user(
    db: Session,
    requested_role: Optional[UserRole] = None,
    action_context: str = "API_REQUEST",
) -> UserProfile:
    """Возвращает активного пользователя сессии и блокирует попытки повышения привилегий (AI-02)."""
    session_user = get_active_user(db)
    if requested_role and get_role_clearance(requested_role) < get_role_clearance(session_user.role):
        add_audit_log(
            db,
            action="ACCESS_DENIED",
            target=action_context,
            status="blocked",
            details=(
                f"Заблокирована попытка повышения привилегий: активная роль {session_user.role} "
                f"передала в запросе более высокий уровень {requested_role}."
            ),
            user=session_user,
        )
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав доступа: повышение привилегий через параметр роли запрещено (AI-02).",
        )
    return session_user
