from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.task_assignee import TaskAssignee
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    project_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: Optional[TaskPriority] = TaskPriority.MEDIUM
    assigned_to: Optional[str] = None
    assignee_ids: Optional[List[str]] = []
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    is_personal: Optional[bool] = False


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[str] = None
    assignee_ids: Optional[List[str]] = None
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None


class TaskResponse(BaseModel):
    id: str
    project_id: Optional[str]
    title: str
    description: Optional[str]
    status: str
    priority: str
    assigned_to: Optional[str]
    assigned_to_name: Optional[str]
    assignees: List[dict]
    created_by: str
    due_date: Optional[str]
    start_date: Optional[str]
    estimated_hours: Optional[float]
    is_personal: bool
    created_at: str


class WorkloadEntry(BaseModel):
    user_id: str
    full_name: str
    open_task_count: int
    total_estimated_hours: float
    load_level: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_task_assignees(task_id, db: Session):
    assignee_rows = db.query(TaskAssignee, User).join(
        User, TaskAssignee.user_id == User.id
    ).filter(TaskAssignee.task_id == task_id).all()
    return [{"id": str(u.id), "full_name": u.full_name, "email": u.email} for ta, u in assignee_rows]


def _task_to_response(task: Task, db: Session) -> TaskResponse:
    assignees = _get_task_assignees(task.id, db)
    assigned_to_id = assignees[0]["id"] if assignees else None
    assigned_to_name = assignees[0]["full_name"] if assignees else None
    
    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id) if task.project_id else None,
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        assigned_to=assigned_to_id,
        assigned_to_name=assigned_to_name,
        assignees=assignees,
        created_by=str(task.created_by),
        due_date=task.due_date.isoformat() if task.due_date else None,
        start_date=task.start_date.isoformat() if task.start_date else None,
        estimated_hours=task.estimated_hours,
        is_personal=task.is_personal,
        created_at=task.created_at.isoformat()
    )


def _bulk_tasks_to_response(tasks: List[Task], db: Session) -> List[TaskResponse]:
    if not tasks:
        return []
    task_ids = [t.id for t in tasks]
    assignee_rows = db.query(TaskAssignee, User).join(
        User, TaskAssignee.user_id == User.id
    ).filter(TaskAssignee.task_id.in_(task_ids)).all()
    
    assignees_by_task = {}
    for ta, u in assignee_rows:
        tid = str(ta.task_id)
        if tid not in assignees_by_task:
            assignees_by_task[tid] = []
        assignees_by_task[tid].append({"id": str(u.id), "full_name": u.full_name, "email": u.email})
        
    responses = []
    for task in tasks:
        task_id_str = str(task.id)
        assignees = assignees_by_task.get(task_id_str, [])
        assigned_to_id = assignees[0]["id"] if assignees else None
        assigned_to_name = assignees[0]["full_name"] if assignees else None
        
        responses.append(TaskResponse(
            id=task_id_str,
            project_id=str(task.project_id) if task.project_id else None,
            title=task.title,
            description=task.description,
            status=task.status.value,
            priority=task.priority.value,
            assigned_to=assigned_to_id,
            assigned_to_name=assigned_to_name,
            assignees=assignees,
            created_by=str(task.created_by),
            due_date=task.due_date.isoformat() if task.due_date else None,
            start_date=task.start_date.isoformat() if task.start_date else None,
            estimated_hours=task.estimated_hours,
            is_personal=task.is_personal,
            created_at=task.created_at.isoformat()
        ))
    return responses


def _assert_project_access(project_id: uuid.UUID, user: User, db: Session, required_role: Optional[str] = None) -> Project:
    if isinstance(project_id, str):
        project_id = uuid.UUID(project_id)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.org_id != user.organisation_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    if user.role in [UserRole.L1, UserRole.L2]:
        return project
        
    if project.created_by == user.id:
        return project
        
    # Check explicit project access
    from app.models.project_access import ProjectAccess
    access = db.query(ProjectAccess).filter(
        ProjectAccess.project_id == project_id,
        ProjectAccess.user_id == user.id
    ).first()
    
    if not access:
        # Check if they have tasks assigned in this project (implicit viewer rights)
        has_assigned_task = db.query(TaskAssignee).join(
            Task, TaskAssignee.task_id == Task.id
        ).filter(
            Task.project_id == project_id,
            TaskAssignee.user_id == user.id
        ).first()
        if not has_assigned_task:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this project")
        # Implicit access grants viewer role. Reject if higher role is required.
        if required_role and required_role != "viewer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient project permissions")
    else:
        if required_role:
            role_hierarchy = {
                "viewer": 1,
                "editor": 2,
                "manager": 3
            }
            user_role_val = role_hierarchy.get(access.role.value, 1)
            req_role_val = role_hierarchy.get(required_role, 1)
            if user_role_val < req_role_val:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient project permissions")
            
    return project


def _assert_task_access(task: Task, user: User, db: Session, required_role: Optional[str] = None):
    if task.is_personal:
        if task.created_by != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to personal task")
        return
        
    if not task.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task has no project and is not marked personal")
    _assert_project_access(task.project_id, user, db, required_role)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TaskResponse])
async def list_all_accessible_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all tasks that the current user has access to.
    - Admins see all non-personal tasks (and their own personal tasks).
    - Managers see all non-personal tasks in their organisation (and their own personal tasks).
    - Others see tasks in projects they created, projects where they have manager/editor access, or tasks explicitly assigned to them.
    """
    if current_user.role == UserRole.L1:
        tasks = db.query(Task).filter(
            or_(Task.is_personal == False, Task.created_by == current_user.id)
        ).all()
    elif current_user.role == UserRole.L2:
        tasks = db.query(Task).join(Project, Task.project_id == Project.id).filter(
            Project.org_id == current_user.organisation_id,
            or_(Task.is_personal == False, Task.created_by == current_user.id)
        ).all()
    else:
        from app.models.project_access import ProjectAccess, ProjectAccessRole
        
        # Projects where user has full task visibility (created project, or has editor/manager role)
        full_access_project_ids = db.query(Project.id).outerjoin(
            ProjectAccess, Project.id == ProjectAccess.project_id
        ).filter(
            Project.org_id == current_user.organisation_id,
            or_(
                Project.created_by == current_user.id,
                (ProjectAccess.user_id == current_user.id) & (ProjectAccess.role.in_([ProjectAccessRole.EDITOR, ProjectAccessRole.MANAGER]))
            )
        ).subquery()
        
        # Query tasks:
        # - Non-personal tasks in full-access projects
        # - OR non-personal tasks where user is explicitly assigned
        # - OR personal tasks created by current user
        tasks = db.query(Task).outerjoin(
            TaskAssignee, Task.id == TaskAssignee.task_id
        ).filter(
            or_(
                (Task.project_id.in_(full_access_project_ids) & (Task.is_personal == False)),
                ((TaskAssignee.user_id == current_user.id) & (Task.is_personal == False)),
                ((Task.is_personal == True) & (Task.created_by == current_user.id))
            )
        ).distinct().all()

    return _bulk_tasks_to_response(tasks, db)


@router.get("/my", response_model=List[TaskResponse])
async def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tasks assigned to the current user OR own personal tasks — powers the dashboard."""
    tasks = db.query(Task).outerjoin(
        TaskAssignee, Task.id == TaskAssignee.task_id
    ).filter(
        or_(
            TaskAssignee.user_id == current_user.id,
            (Task.is_personal == True) & (Task.created_by == current_user.id)
        ),
        Task.status != TaskStatus.DONE
    ).order_by(Task.due_date).distinct().all()
    return _bulk_tasks_to_response(tasks, db)


@router.get("/workload", response_model=List[WorkloadEntry])
async def get_workload(
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    """
    Per-user open task count + estimated hours for the smart workload badge.
    Only admin/manager can see this. Optimized to avoid N+1 queries.
    """
    open_statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW]

    # Query counts and total hours grouped by user_id for open tasks using TaskAssignee join
    workload_query = db.query(
        TaskAssignee.user_id,
        func.count(Task.id).label("task_count"),
        func.sum(Task.estimated_hours).label("total_hours")
    ).join(
        Task, TaskAssignee.task_id == Task.id
    ).filter(
        Task.status.in_(open_statuses),
        Task.is_personal == False
    ).group_by(TaskAssignee.user_id).all()

    workload_map = {
        str(user_id): (count, float(hours or 0))
        for user_id, count, hours in workload_query
    }

    # Query org members
    if current_user.role == UserRole.L1:
        users = db.query(User).filter(User.is_active == True).all()
    else:
        users = db.query(User).filter(
            User.organisation_id == current_user.organisation_id,
            User.is_active == True
        ).all()

    entries = []
    for user in users:
        count, hours = workload_map.get(str(user.id), (0, 0.0))

        if count == 0:
            load = "low"
        elif count <= 3 and hours <= 20:
            load = "medium"
        else:
            load = "high"

        entries.append(WorkloadEntry(
            user_id=str(user.id),
            full_name=user.full_name,
            open_task_count=count,
            total_estimated_hours=hours,
            load_level=load
        ))

    return entries


@router.post("", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_personal = task.is_personal or task.project_id is None
    
    if is_personal:
        new_task = Task(
            project_id=None,
            title=task.title,
            description=task.description,
            status=TaskStatus.TODO,
            priority=task.priority,
            created_by=current_user.id,
            due_date=task.due_date,
            start_date=task.start_date,
            is_personal=True,
            estimated_hours=task.estimated_hours
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        
        # Auto-assign to self
        assignee = TaskAssignee(task_id=new_task.id, user_id=current_user.id)
        db.add(assignee)
        db.commit()
        db.refresh(new_task)
        
        # Log task creation
        from app.core.audit import log_audit
        log_audit(db, current_user.id, "create", "task", new_task.id, request)
        db.commit()
        
        return _task_to_response(new_task, db)

    _assert_project_access(task.project_id, current_user, db, required_role="editor")

    # Combine assigned_to and assignee_ids
    assignee_ids = list(task.assignee_ids or [])
    if task.assigned_to and task.assigned_to not in assignee_ids:
        assignee_ids.append(task.assigned_to)

    # Validate and build list of valid assignee IDs
    valid_assignee_ids = []
    for uid in assignee_ids:
        if not uid:
            continue
        try:
            user_uuid = uuid.UUID(uid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid assignee user ID format: {uid}"
            )
        assigned_user = db.query(User).filter(
            User.id == user_uuid,
            User.organisation_id == current_user.organisation_id,
            User.is_active == True
        ).first()
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Assigned user {uid} must belong to your organisation"
            )
        valid_assignee_ids.append(assigned_user.id)

    first_assignee_id = valid_assignee_ids[0] if valid_assignee_ids else None

    # Handle project_id format parsing safely
    try:
        proj_id = uuid.UUID(task.project_id) if isinstance(task.project_id, str) else task.project_id
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project ID format: {task.project_id}"
        )

    new_task = Task(
        project_id=proj_id,
        title=task.title,
        description=task.description,
        status=TaskStatus.TODO,
        priority=task.priority,
        assigned_to=first_assignee_id,
        created_by=current_user.id,
        due_date=task.due_date,
        start_date=task.start_date,
        is_personal=False,
        estimated_hours=task.estimated_hours
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Create task assignees
    from app.models.notification import Notification
    from app.core.email import send_email
    for uid in valid_assignee_ids:
        db.add(TaskAssignee(task_id=new_task.id, user_id=uid))
        
        # Notification to assignees (except creator)
        if uid != current_user.id:
            db.add(Notification(
                user_id=uid,
                type="task_assigned",
                payload={
                    "message": f"Task '{new_task.title}' assigned to you by {current_user.full_name}.",
                    "link": f"/projects/{new_task.project_id}?task={new_task.id}"
                },
                is_read=False
            ))
            
            # Send email notification to assignee
            assigned_user = db.query(User).filter(User.id == uid).first()
            if assigned_user and assigned_user.email:
                subject = f"New Task Assigned: {new_task.title}"
                due_date_str = "No due date"
                if new_task.due_date:
                    if hasattr(new_task.due_date, 'strftime'):
                        due_date_str = new_task.due_date.strftime('%d-%b-%Y')
                    else:
                        due_date_str = str(new_task.due_date)
                body = f"""
                <p>Hello <strong>{assigned_user.full_name}</strong>,</p>
                <p>You have been assigned a new task <strong>"{new_task.title}"</strong> by {current_user.full_name}.</p>
                <p><strong>Priority:</strong> {new_task.priority.value.capitalize()}</p>
                <p><strong>Due Date:</strong> {due_date_str}</p>
                <p>You can view and update the task on your dashboard or project board.</p>
                <p>Best regards,<br>The WorkHive Team</p>
                """
                background_tasks.add_task(send_email, assigned_user.email, subject, body)
            
    db.commit()

    # Log task creation
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "create", "task", new_task.id, request)
    db.commit()

    return _task_to_response(new_task, db)


# ── Personal Tasks Endpoints ───────────────────────────────────────────────────

@router.post("/personal", response_model=TaskResponse)
async def create_personal_task(
    task: TaskCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_task = Task(
        project_id=None,
        title=task.title,
        description=task.description,
        status=TaskStatus.TODO,
        priority=task.priority,
        created_by=current_user.id,
        due_date=task.due_date,
        start_date=task.start_date,
        is_personal=True,
        estimated_hours=task.estimated_hours
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    # Auto-assign to self
    assignee = TaskAssignee(task_id=new_task.id, user_id=current_user.id)
    db.add(assignee)
    
    # Log task creation
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "create", "task", new_task.id, request)
    db.commit()
    
    return _task_to_response(new_task, db)


@router.get("/personal", response_model=List[TaskResponse])
async def get_personal_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(Task).filter(
        Task.is_personal == True,
        Task.created_by == current_user.id
    ).order_by(Task.due_date).all()
    return _bulk_tasks_to_response(tasks, db)


@router.put("/personal/{task_id}", response_model=TaskResponse)
async def update_personal_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal == True
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")
        
    if task.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this task")
        
    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.status is not None:
        task.status = task_update.status
    if task_update.priority is not None:
        task.priority = task_update.priority
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    if task_update.start_date is not None:
        task.start_date = task_update.start_date
    if task_update.estimated_hours is not None:
        task.estimated_hours = task_update.estimated_hours
        
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "update", "task", task.id, request)
    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


@router.delete("/personal/{task_id}")
async def delete_personal_task(
    task_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.is_personal == True
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal task not found")
        
    if task.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")
        
    from app.models.task_comment import TaskComment
    db.query(TaskComment).filter(TaskComment.task_id == task_id).delete()
    
    from app.models.file import File
    db.query(File).filter(File.task_id == task_id).update({"task_id": None})
    
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "delete", "task", task.id, request)
    
    db.delete(task)
    db.commit()
    return {"message": "Personal task deleted successfully"}


@router.get("/project/{project_id}", response_model=List[TaskResponse])
async def get_project_tasks(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _assert_project_access(project_id, current_user, db)
    
    if current_user.role in [UserRole.L1, UserRole.L2]:
        tasks = db.query(Task).filter(Task.project_id == project_id, Task.is_personal == False).all()
    else:
        from app.models.project_access import ProjectAccess, ProjectAccessRole
        access = db.query(ProjectAccess).filter(
            ProjectAccess.project_id == project_id,
            ProjectAccess.user_id == current_user.id
        ).first()
        
        project = db.query(Project).filter(Project.id == project_id).first()
        
        # If they are project editor/manager or project creator, they see all tasks
        if (access and access.role in [ProjectAccessRole.EDITOR, ProjectAccessRole.MANAGER]) or (project and project.created_by == current_user.id):
            tasks = db.query(Task).filter(Task.project_id == project_id, Task.is_personal == False).all()
        else:
            # Otherwise (viewers / implicit access), they only see tasks assigned to them
            tasks = db.query(Task).join(
                TaskAssignee, Task.id == TaskAssignee.task_id
            ).filter(
                Task.project_id == project_id,
                Task.is_personal == False,
                TaskAssignee.user_id == current_user.id
            ).all()
            
    return _bulk_tasks_to_response(tasks, db)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    _assert_task_access(task, current_user, db)
    return _task_to_response(task, db)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    _assert_task_access(task, current_user, db)

    # Determine if user has write/edit permissions
    has_write_rights = False
    if task.is_personal:
        if task.created_by == current_user.id:
            has_write_rights = True
    else:
        if current_user.role in [UserRole.L1, UserRole.L2] or task.created_by == current_user.id:
            has_write_rights = True
        else:
            from app.models.project_access import ProjectAccess
            access = db.query(ProjectAccess).filter(
                ProjectAccess.project_id == task.project_id,
                ProjectAccess.user_id == current_user.id
            ).first()
            if access and access.role.value in ["editor", "manager"]:
                has_write_rights = True

    if not has_write_rights:
        is_assigned = db.query(TaskAssignee).filter(
            TaskAssignee.task_id == task.id,
            TaskAssignee.user_id == current_user.id
        ).first()
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this task"
            )
        if (task_update.title is not None or 
            task_update.description is not None or 
            task_update.priority is not None or 
            task_update.assigned_to is not None or 
            task_update.assignee_ids is not None or 
            task_update.due_date is not None or 
            task_update.start_date is not None or 
            task_update.estimated_hours is not None):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only task status can be updated on assigned tasks without editor access"
            )

    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    status_changed = False
    old_status = task.status
    if task_update.status is not None:
        if task_update.status != task.status:
            status_changed = True
        task.status = task_update.status
    if task_update.priority is not None:
        task.priority = task_update.priority
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    if task_update.start_date is not None:
        task.start_date = task_update.start_date
    if task_update.estimated_hours is not None:
        task.estimated_hours = task_update.estimated_hours

    # Handle assignee updates
    if not task.is_personal and (task_update.assignee_ids is not None or task_update.assigned_to is not None):
        new_assignee_ids = []
        if task_update.assignee_ids is not None:
            new_assignee_ids = list(task_update.assignee_ids)
        elif task_update.assigned_to is not None:
            new_assignee_ids = [task_update.assigned_to] if task_update.assigned_to else []

        valid_assignee_ids = []
        for uid in new_assignee_ids:
            if not uid:
                continue
            try:
                user_uuid = uuid.UUID(uid)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid assignee user ID format: {uid}"
                )
            assigned_user = db.query(User).filter(
                User.id == user_uuid,
                User.organisation_id == current_user.organisation_id,
                User.is_active == True
            ).first()
            if not assigned_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Assigned user {uid} must belong to your organisation"
                )
            valid_assignee_ids.append(assigned_user.id)

        # Get existing assignees
        existing_assignees = db.query(TaskAssignee).filter(TaskAssignee.task_id == task.id).all()
        existing_uids = {ea.user_id for ea in existing_assignees}
        new_uids_set = set(valid_assignee_ids)

        # Delete removed assignees
        for ea in existing_assignees:
            if ea.user_id not in new_uids_set:
                db.delete(ea)

        # Add new assignees and notify
        from app.models.notification import Notification
        from app.core.email import send_email
        for uid in new_uids_set:
            if uid not in existing_uids:
                db.add(TaskAssignee(task_id=task.id, user_id=uid))
                if uid != current_user.id:
                    db.add(Notification(
                        user_id=uid,
                        type="task_assigned",
                        payload={
                            "message": f"Task '{task.title}' assigned to you by {current_user.full_name}.",
                            "link": f"/projects/{task.project_id}?task={task.id}"
                        },
                        is_read=False
                    ))
                    
                    # Send email notification to new assignee
                    assigned_user = db.query(User).filter(User.id == uid).first()
                    if assigned_user and assigned_user.email:
                        subject = f"New Task Assigned: {task.title}"
                        due_date_str = "No due date"
                        if task.due_date:
                            if hasattr(task.due_date, 'strftime'):
                                due_date_str = task.due_date.strftime('%d-%b-%Y')
                            else:
                                due_date_str = str(task.due_date)
                        body = f"""
                        <p>Hello <strong>{assigned_user.full_name}</strong>,</p>
                        <p>You have been assigned a new task <strong>"{task.title}"</strong> by {current_user.full_name}.</p>
                        <p><strong>Priority:</strong> {task.priority.value.capitalize()}</p>
                        <p><strong>Due Date:</strong> {due_date_str}</p>
                        <p>You can view and update the task on your dashboard or project board.</p>
                        <p>Best regards,<br>The WorkHive Team</p>
                        """
                        background_tasks.add_task(send_email, assigned_user.email, subject, body)

        # Backward compatibility assigned_to
        task.assigned_to = valid_assignee_ids[0] if valid_assignee_ids else None

    from app.core.audit import log_audit
    log_audit(db, current_user.id, "update", "task", task.id, request)

    db.commit()
    db.refresh(task)

    # Send status update notifications
    if status_changed and not task.is_personal:
        # Fetch current assignees
        assignee_rows = db.query(TaskAssignee).filter(TaskAssignee.task_id == task.id).all()
        notify_user_ids = {task.created_by} | {row.user_id for row in assignee_rows}
        notify_user_ids.discard(current_user.id)

        from app.models.notification import Notification
        from app.core.email import send_email

        for uid in notify_user_ids:
            db.add(Notification(
                user_id=uid,
                type="task_status_updated",
                payload={
                    "message": f"Task '{task.title}' status changed from '{old_status.value.replace('_', ' ')}' to '{task.status.value.replace('_', ' ')}' by {current_user.full_name}.",
                    "link": f"/projects/{task.project_id}?task={task.id}"
                },
                is_read=False
            ))

            recipient = db.query(User).filter(User.id == uid).first()
            if recipient and recipient.email:
                subject = f"Task Status Updated: {task.title}"
                body = f"""
                <p>Hello <strong>{recipient.full_name}</strong>,</p>
                <p>The status of the task <strong>"{task.title}"</strong> has been updated by {current_user.full_name}.</p>
                <p><strong>Status Change:</strong> <code>{old_status.value.replace('_', ' ').upper()}</code> &rarr; <code>{task.status.value.replace('_', ' ').upper()}</code></p>
                <p>You can view the task details and progress on your dashboard.</p>
                <p>Best regards,<br>The WorkHive Team</p>
                """
                background_tasks.add_task(send_email, recipient.email, subject, body)
        
        db.commit()
            
    return _task_to_response(task, db)


@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    if task.is_personal:
        if task.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")
    else:
        _assert_project_access(str(task.project_id), current_user, db, required_role="manager")

    from app.models.task_comment import TaskComment
    db.query(TaskComment).filter(TaskComment.task_id == task_id).delete()

    from app.models.file import File
    db.query(File).filter(File.task_id == task_id).update({"task_id": None})

    from app.core.audit import log_audit
    log_audit(db, current_user.id, "delete", "task", task.id, request)

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

