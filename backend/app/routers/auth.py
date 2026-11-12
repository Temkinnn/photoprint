from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.models import DBUser
from app.db.session import get_db
from app.db.storage import EXTRA_STAFF
from app.schemas import ParticipantOption, SwitchRoleRequest, UserProfile
from app.services.audit import add_audit_log, get_active_user, switch_active_role

router = APIRouter(prefix="/auth", tags=["Аутентификация и Роли"])


def _to_short_name(full_name: str) -> str:
    parts = (full_name or "").split()
    if len(parts) >= 3:
        return f"{parts[0]} {parts[1][0]}.{parts[2][0]}."
    if len(parts) == 2:
        return f"{parts[0]} {parts[1][0]}."
    return full_name


@router.get("/me", response_model=UserProfile)
async def get_current_user(db: Session = Depends(get_db)):
    return get_active_user(db)


@router.post("/switch-role", response_model=UserProfile)
async def switch_role(req: SwitchRoleRequest, db: Session = Depends(get_db)):
    updated_user = switch_active_role(db, req.role)
    add_audit_log(
        db,
        action="SWITCH_ROLE",
        target=f"Профиль {updated_user.name}",
        status="success",
        details=f"Пользователь переключил контекст роли на: {req.role} ({updated_user.roleTitle})",
        user=updated_user,
    )
    return updated_user


@router.get("/users", response_model=List[ParticipantOption])
async def get_participants_catalog(db: Session = Depends(get_db)):
    """Возвращает каталог всех сотрудников для выбора участников совещания."""
    db_users = db.query(DBUser).all()
    result: List[ParticipantOption] = [
        ParticipantOption(
            id=u.id,
            name=u.name,
            shortName=_to_short_name(u.name),
            roleTitle=u.role_title,
            department=u.department,
            role=u.role,
            isSystemUser=True,
        )
        for u in db_users
    ]
    for st in EXTRA_STAFF:
        result.append(
            ParticipantOption(
                id=st["id"],
                name=st["name"],
                shortName=st["shortName"],
                roleTitle=st["roleTitle"],
                department=st["department"],
                role=None,
                isSystemUser=False,
            )
        )
    return result
