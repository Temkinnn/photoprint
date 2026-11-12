from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from app.db.models import DBTask
from app.db.session import get_db
from app.schemas import TaskItem, TaskUpdateRequest
from app.services.audit import add_audit_log

router = APIRouter(prefix="/tasks", tags=["Реестр Задач"])


def _to_task_item(t: DBTask) -> TaskItem:
    return TaskItem(
        id=t.id,
        title=t.title,
        assigneeName=t.assignee_name,
        deadline=t.deadline,
        sourceQuote=t.source_quote,
        timestamp=t.timestamp,
        status=t.status,
        meetingTitle=t.meeting_title,
        protocolId=t.protocol_id,
    )


@router.get("/", response_model=List[TaskItem])
async def get_tasks(db: Session = Depends(get_db)):
    rows = db.query(DBTask).all()
    return [_to_task_item(t) for t in reversed(rows)]


@router.patch("/{task_id}", response_model=TaskItem)
async def update_task(task_id: str, req: TaskUpdateRequest, db: Session = Depends(get_db)):
    task = db.query(DBTask).filter(DBTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    if req.title is not None:
        task.title = req.title
    if req.assigneeName is not None:
        task.assignee_name = req.assigneeName
    if req.deadline is not None:
        task.deadline = req.deadline
    if req.status is not None:
        task.status = req.status

    db.commit()
    db.refresh(task)
    add_audit_log(
        db,
        action="UPDATE_TASK",
        target=f"{task.id} ({task.title})",
        status="success",
        details=f"Обновлен статус/параметры задачи: статус={task.status}, ответственный={task.assignee_name}",
    )
    return _to_task_item(task)


@router.delete("/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(DBTask).filter(DBTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    db.delete(task)
    db.commit()
    add_audit_log(
        db,
        action="DELETE_TASK",
        target=task_id,
        status="warning",
        details="Задача удалена из реестра руководителем",
    )
    return {"status": "success", "deletedTaskId": task_id}
