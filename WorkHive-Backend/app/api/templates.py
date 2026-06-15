from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.task_template import TaskTemplate
from app.models.task_template_usage import TaskTemplateUsage
from app.models.project_category import ProjectCategory
from app.core.audit import log_audit

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    category_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class TemplateUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    category_id: str
    category_name: str
    title: str
    description: Optional[str]
    usage_count: int
    last_used_at: Optional[str]
    created_at: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TemplateResponse])
async def get_templates(
    category_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List task templates with usage stats, ordered by usage and recency"""
    query = db.query(
        TaskTemplate,
        TaskTemplateUsage.usage_count,
        TaskTemplateUsage.last_used_at
    ).outerjoin(
        TaskTemplateUsage,
        (TaskTemplateUsage.template_id == TaskTemplate.id) & 
        (TaskTemplateUsage.user_id == current_user.id)
    )
    
    if category_id:
        query = query.filter(TaskTemplate.category_id == category_id)
        
    if search:
        query = query.filter(TaskTemplate.title.ilike(f"%{search}%"))
        
    # Order by count desc (nulls last), then last used date desc (nulls last), then title asc
    query = query.order_by(
        desc(TaskTemplateUsage.usage_count),
        desc(TaskTemplateUsage.last_used_at),
        TaskTemplate.title.asc()
    )
    
    results = query.all()
    
    response = []
    for tpl, count, last_used in results:
        response.append(TemplateResponse(
            id=str(tpl.id),
            category_id=str(tpl.category_id),
            category_name=tpl.category.name if tpl.category else "",
            title=tpl.title,
            description=tpl.description,
            usage_count=count or 0,
            last_used_at=last_used.isoformat() if last_used else None,
            created_at=tpl.created_at.isoformat() if tpl.created_at else ""
        ))
    return response


@router.post("", response_model=TemplateResponse)
async def create_template(
    payload: TemplateCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Create a new task template (L1 Super Admin only)"""
    cat = db.query(ProjectCategory).filter(ProjectCategory.id == payload.category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project category not found"
        )
        
    tpl = TaskTemplate(
        category_id=payload.category_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    
    log_audit(db, current_user.id, "create", "task_template", tpl.id, request)
    
    return TemplateResponse(
        id=str(tpl.id),
        category_id=str(tpl.category_id),
        category_name=cat.name,
        title=tpl.title,
        description=tpl.description,
        usage_count=0,
        last_used_at=None,
        created_at=tpl.created_at.isoformat() if tpl.created_at else ""
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Update a task template (L1 Super Admin only)"""
    tpl = db.query(TaskTemplate).filter(TaskTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
        
    if payload.category_id is not None:
        cat = db.query(ProjectCategory).filter(ProjectCategory.id == payload.category_id).first()
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project category not found"
            )
        tpl.category_id = payload.category_id
        
    if payload.title is not None:
        tpl.title = payload.title.strip()
        
    if payload.description is not None:
        tpl.description = payload.description.strip() if payload.description else None
        
    db.commit()
    db.refresh(tpl)
    
    log_audit(db, current_user.id, "update", "task_template", tpl.id, request)
    
    # Get usage info
    usage = db.query(TaskTemplateUsage).filter(
        TaskTemplateUsage.user_id == current_user.id,
        TaskTemplateUsage.template_id == tpl.id
    ).first()
    
    return TemplateResponse(
        id=str(tpl.id),
        category_id=str(tpl.category_id),
        category_name=tpl.category.name if tpl.category else "",
        title=tpl.title,
        description=tpl.description,
        usage_count=usage.usage_count if usage else 0,
        last_used_at=usage.last_used_at.isoformat() if usage else None,
        created_at=tpl.created_at.isoformat() if tpl.created_at else ""
    )


@router.delete("/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Delete a task template (L1 Super Admin only)"""
    tpl = db.query(TaskTemplate).filter(TaskTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
        
    db.delete(tpl)
    db.commit()
    
    log_audit(db, current_user.id, "delete", "task_template", template_id, request)
    return {"message": "Template deleted successfully"}


@router.post("/{template_id}/use")
async def record_template_usage(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record that a template was used by the current user (increments usage count and updates recency)"""
    tpl = db.query(TaskTemplate).filter(TaskTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
        
    usage = db.query(TaskTemplateUsage).filter(
        TaskTemplateUsage.user_id == current_user.id,
        TaskTemplateUsage.template_id == template_id
    ).first()
    
    if not usage:
        usage = TaskTemplateUsage(
            user_id=current_user.id,
            template_id=template_id,
            usage_count=1,
            last_used_at=datetime.now(timezone.utc)
        )
        db.add(usage)
    else:
        usage.usage_count += 1
        usage.last_used_at = datetime.now(timezone.utc)
        
    db.commit()
    return {"message": "Usage recorded successfully", "usage_count": usage.usage_count}
