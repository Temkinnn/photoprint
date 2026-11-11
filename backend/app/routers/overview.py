from fastapi import APIRouter
from typing import List
from app.db.storage import storage
from app.schemas import KPIMetric, AuditLogEntry, OverviewBriefResponse

router = APIRouter(prefix="/overview", tags=["Управленческий обзор и Аудит"])

@router.get("/metrics", response_model=List[KPIMetric])
async def get_kpi_metrics():
    return storage.metrics

@router.get("/brief", response_model=OverviewBriefResponse)
async def get_overview_brief():
    return storage.overview_brief

@router.get("/audit", response_model=List[AuditLogEntry])
async def get_audit_logs():
    return storage.audit_logs
