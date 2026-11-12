from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from app.db.models import DBAuditLog, DBKPIMetric
from app.db.session import get_db
from app.schemas import AuditLogEntry, KPIMetric

router = APIRouter(prefix="/overview", tags=["Управленческий обзор и Аудит"])


@router.get("/metrics", response_model=List[KPIMetric])
async def get_kpi_metrics(db: Session = Depends(get_db)):
    rows = db.query(DBKPIMetric).all()
    return [
        KPIMetric(
            id=m.id,
            name=m.name,
            value=m.value,
            target=m.target,
            status=m.status,
            sourceSystem=m.source_system,
            updatedAt=m.updated_at,
            trend=m.trend,
        )
        for m in rows
    ]


@router.get("/audit", response_model=List[AuditLogEntry])
async def get_audit_logs(db: Session = Depends(get_db)):
    rows = db.query(DBAuditLog).order_by(DBAuditLog.timestamp.desc()).all()
    return [
        AuditLogEntry(
            id=a.id,
            timestamp=a.timestamp,
            userId=a.user_id,
            userName=a.user_name,
            userRole=a.user_role,
            action=a.action,
            targetObject=a.target_object,
            status=a.status,
            details=a.details,
        )
        for a in rows
    ]
