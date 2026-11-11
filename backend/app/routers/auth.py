from fastapi import APIRouter
from app.db.storage import storage
from app.schemas import UserProfile, SwitchRoleRequest

router = APIRouter(prefix="/auth", tags=["Аутентификация и Роли"])

@router.get("/me", response_model=UserProfile)
async def get_current_user():
    return storage.get_current_user()

@router.post("/switch-role", response_model=UserProfile)
async def switch_role(req: SwitchRoleRequest):
    updated_user = storage.switch_role(req.role)
    storage.add_audit_log(
        action="SWITCH_ROLE",
        target=f"Профиль {updated_user.name}",
        status="success",
        details=f"Пользователь переключил контекст роли на: {req.role} ({updated_user.roleTitle})"
    )
    return updated_user
