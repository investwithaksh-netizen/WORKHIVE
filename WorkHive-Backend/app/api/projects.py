from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.api.auth import get_current_user, require_role
from app.models.task import Task
from app.models.project_category import ProjectCategory

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


# Schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    category_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    due_date: Optional[datetime] = None
    category_id: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    due_date: Optional[str]
    created_by: str
    created_by_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    created_at: str


class ProjectAccessCreate(BaseModel):
    user_id: str
    role: str  # "viewer", "editor", "manager"


class ProjectAccessResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    granted_at: str


@router.post("", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    cat_id = None
    if project.category_id:
        try:
            cat_uuid = uuid.UUID(project.category_id)
            cat = db.query(ProjectCategory).filter(ProjectCategory.id == cat_uuid).first()
            if cat:
                cat_id = cat.id
        except ValueError:
            pass
            
    if not cat_id:
        # Fallback to General category
        general_cat = db.query(ProjectCategory).filter(ProjectCategory.name == "General").first()
        if general_cat:
            cat_id = general_cat.id

    new_project = Project(
        org_id=current_user.organisation_id,
        name=project.name,
        description=project.description,
        status=ProjectStatus.PLANNING,
        due_date=project.due_date,
        category_id=cat_id,
        created_by=current_user.id
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    # Log project creation
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "create", "project", new_project.id, request)
    db.commit()
    
    return ProjectResponse(
        id=str(new_project.id),
        name=new_project.name,
        description=new_project.description,
        status=new_project.status.value,
        due_date=new_project.due_date.isoformat() if new_project.due_date else None,
        created_by=str(new_project.created_by),
        created_by_name=current_user.full_name,
        category_id=str(new_project.category_id) if new_project.category_id else None,
        category_name=new_project.category.name if new_project.category else None,
        created_at=new_project.created_at.isoformat()
    )


@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.organisation_id:
        return []

    if current_user.role == UserRole.L1:
        projects = db.query(Project).filter(
            Project.org_id == current_user.organisation_id
        ).offset(skip).limit(limit).all()
    elif current_user.role == UserRole.L2:
        projects = db.query(Project).filter(
            Project.org_id == current_user.organisation_id
        ).offset(skip).limit(limit).all()
    else:
        # L3 and Clients can only see projects they created, have been granted access to, or have tasks assigned to them
        from app.models.project_access import ProjectAccess
        from app.models.task_assignee import TaskAssignee
        
        granted_proj_query = db.query(ProjectAccess.project_id).filter(
            ProjectAccess.user_id == current_user.id
        ).subquery()
        
        task_proj_query = db.query(Task.project_id).join(
            TaskAssignee, Task.id == TaskAssignee.task_id
        ).filter(
            TaskAssignee.user_id == current_user.id
        ).subquery()
        
        projects = db.query(Project).filter(
            Project.org_id == current_user.organisation_id,
            (Project.id.in_(granted_proj_query) | 
             Project.id.in_(task_proj_query) |
             (Project.created_by == current_user.id))
        ).offset(skip).limit(limit).all()
    
    # Fetch all creator names in one query to avoid N+1 queries
    creator_ids = list({p.created_by for p in projects})
    creator_map = {}
    if creator_ids:
        creators = db.query(User.id, User.full_name).filter(User.id.in_(creator_ids)).all()
        creator_map = {str(uid): name for uid, name in creators}
    
    return [
        ProjectResponse(
            id=str(p.id),
            name=p.name,
            description=p.description,
            status=p.status.value,
            due_date=p.due_date.isoformat() if p.due_date else None,
            created_by=str(p.created_by),
            created_by_name=creator_map.get(str(p.created_by)),
            category_id=str(p.category_id) if p.category_id else None,
            category_name=p.category.name if p.category else None,
            created_at=p.created_at.isoformat()
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organisation access first
    if project.org_id != current_user.organisation_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this project"
        )
        
    # Check project-level IAM access for non-admins and non-managers
    if current_user.role not in [UserRole.L1, UserRole.L2]:
        from app.models.project_access import ProjectAccess
        from app.models.task_assignee import TaskAssignee
        
        has_access = db.query(ProjectAccess).filter(
            ProjectAccess.project_id == project_id,
            ProjectAccess.user_id == current_user.id
        ).first()
        
        has_assigned_task = db.query(Task).join(
            TaskAssignee, Task.id == TaskAssignee.task_id
        ).filter(
            Task.project_id == project_id,
            TaskAssignee.user_id == current_user.id
        ).first()
        
        if not has_access and not has_assigned_task and project.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this project"
            )
    
    creator_name = None
    creator = db.query(User).filter(User.id == project.created_by).first()
    if creator:
        creator_name = creator.full_name

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        status=project.status.value,
        due_date=project.due_date.isoformat() if project.due_date else None,
        created_by=str(project.created_by),
        created_by_name=creator_name,
        category_id=str(project.category_id) if project.category_id else None,
        category_name=project.category.name if project.category else None,
        created_at=project.created_at.isoformat()
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    project_update: ProjectUpdate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organisation access
    if project.org_id != current_user.organisation_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this project"
        )
    
    if project_update.name is not None:
        project.name = project_update.name
    if project_update.description is not None:
        project.description = project_update.description
    if project_update.status is not None:
        project.status = project_update.status
    if project_update.due_date is not None:
        project.due_date = project_update.due_date
    if project_update.category_id is not None:
        if not project_update.category_id:
            project.category_id = None
        else:
            try:
                cat_uuid = uuid.UUID(project_update.category_id)
                cat = db.query(ProjectCategory).filter(ProjectCategory.id == cat_uuid).first()
                if not cat:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Project category not found"
                    )
                project.category_id = cat.id
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid category UUID format"
                )
    
    # Log project update
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "update", "project", project.id, request)

    db.commit()
    db.refresh(project)
    
    creator_name = None
    creator = db.query(User).filter(User.id == project.created_by).first()
    if creator:
        creator_name = creator.full_name

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        status=project.status.value,
        due_date=project.due_date.isoformat() if project.due_date else None,
        created_by=str(project.created_by),
        created_by_name=creator_name,
        category_id=str(project.category_id) if project.category_id else None,
        category_name=project.category.name if project.category else None,
        created_at=project.created_at.isoformat()
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organisation access
    if project.org_id != current_user.organisation_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this project"
        )
    
    # 1. Delete project files from Google Drive and DB
    from app.models.file import File
    files = db.query(File).filter(File.project_id == project_id).all()
    from app.core.gcs import drive_service
    for f in files:
        # Get uploader credentials
        uploader = db.query(User).filter(User.id == f.uploaded_by).first()
        uploader_token = uploader.google_drive_token if uploader else None
        uploader_refresh = uploader.google_drive_refresh_token if uploader else None
        
        if not uploader_token:
            uploader_token = current_user.google_drive_token
            uploader_refresh = current_user.google_drive_refresh_token
            
        if uploader_token:
            try:
                drive_service.delete_file(f.drive_file_id, uploader_token, uploader_refresh)
            except Exception:
                pass  # Proceed even if Drive delete fails to avoid blocking DB cleanup
        db.delete(f)

    # 2. Delete ChatRooms and ChatMessages
    from app.models.chat_room import ChatRoom
    from app.models.chat_message import ChatMessage
    rooms = db.query(ChatRoom).filter(ChatRoom.project_id == project_id).all()
    for r in rooms:
        db.query(ChatMessage).filter(ChatMessage.room_id == r.id).delete()
        db.delete(r)

    # 3. Delete ProjectAccess entries
    from app.models.project_access import ProjectAccess
    db.query(ProjectAccess).filter(ProjectAccess.project_id == project_id).delete()

    # 4. Delete Tasks and TaskComments
    from app.models.task import Task
    from app.models.task_comment import TaskComment
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    for t in tasks:
        db.query(TaskComment).filter(TaskComment.task_id == t.id).delete()
        db.delete(t)

    # Log project deletion
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "delete", "project", project.id, request)

    # 5. Delete the Project itself
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/access", response_model=List[ProjectAccessResponse])
async def get_project_access(
    project_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    # Verify project exists and is in user's org
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or project.org_id != current_user.organisation_id:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.models.project_access import ProjectAccess
    access_entries = db.query(ProjectAccess).filter(ProjectAccess.project_id == project_id).all()
    
    result = []
    for entry in access_entries:
        user_info = db.query(User).filter(User.id == entry.user_id).first()
        if user_info:
            result.append(ProjectAccessResponse(
                user_id=str(entry.user_id),
                full_name=user_info.full_name,
                email=user_info.email,
                role=entry.role.value,
                granted_at=entry.granted_at.isoformat()
            ))
            
    return result


@router.post("/{project_id}/access")
async def grant_project_access(
    project_id: uuid.UUID,
    access_data: ProjectAccessCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or project.org_id != current_user.organisation_id:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify target user is in same organisation
    target_user = db.query(User).filter(
        User.id == uuid.UUID(access_data.user_id),
        User.organisation_id == current_user.organisation_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in your organisation")

    from app.models.project_access import ProjectAccess, ProjectAccessRole
    
    try:
        role_enum = ProjectAccessRole(access_data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    # Check if rights already exist
    existing_entry = db.query(ProjectAccess).filter(
        ProjectAccess.project_id == project_id,
        ProjectAccess.user_id == uuid.UUID(access_data.user_id)
    ).first()

    if existing_entry:
        existing_entry.role = role_enum
        
        # Log project access update
        from app.core.audit import log_audit
        log_audit(db, current_user.id, "update_access", "project", project_id, request)
        
        db.commit()
        return {"message": "Project access updated"}
    
    new_entry = ProjectAccess(
        project_id=project_id,
        user_id=uuid.UUID(access_data.user_id),
        role=role_enum
    )
    # Log project access grant
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "grant_access", "project", project_id, request)

    db.add(new_entry)
    db.commit()
    
    return {"message": "Project access granted"}


@router.delete("/{project_id}/access/{user_id}")
async def revoke_project_access(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or project.org_id != current_user.organisation_id:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.models.project_access import ProjectAccess
    entry = db.query(ProjectAccess).filter(
        ProjectAccess.project_id == project_id,
        ProjectAccess.user_id == user_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Access record not found")
        
    # Log project access revocation
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "revoke_access", "project", project_id, request)

    db.delete(entry)
    db.commit()
    
    return {"message": "Project access revoked"}
