from fastapi import APIRouter, HTTPException
from typing import List
from app.db.storage import storage
from app.schemas import TaskItem, TaskUpdateRequest

router = APIRouter(prefix="/tasks", tags=["Реестр Задач"])

@router.get("/", response_model=List[TaskItem])
async def get_tasks():
    return storage.tasks

@router.patch("/{task_id}", response_model=TaskItem)
async def update_task(task_id: str, req: TaskUpdateRequest):
    for task in storage.tasks:
        if task.id == task_id:
            if req.title is not None:
                task.title = req.title
            if req.assigneeName is not None:
                task.assigneeName = req.assigneeName
            if req.deadline is not None:
                task.deadline = req.deadline
            if req.status is not None:
                task.status = req.status
            
            storage.add_audit_log(
                action="UPDATE_TASK",
                target=f"{task.id} ({task.title})",
                status="success",
                details=f"Обновлен статус/параметры задачи: статус={task.status}, ответственный={task.assigneeName}"
            )
            return task

    raise HTTPException(status_code=404, detail="Задача не найдена")

@router.delete("/{task_id}")
async def delete_task(task_id: str):
    initial_len = len(storage.tasks)
    storage.tasks = [t for t in storage.tasks if t.id != task_id]
    if len(storage.tasks) == initial_len:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    storage.add_audit_log(
        action="DELETE_TASK",
        target=task_id,
        status="warning",
        details="Задача удалена из реестра руководителем"
    )
    return {"status": "success", "deletedTaskId": task_id}
