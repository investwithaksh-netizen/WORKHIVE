from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.project_category import ProjectCategory
from app.core.audit import log_audit

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _cat_to_response(cat: ProjectCategory) -> CategoryResponse:
    return CategoryResponse(
        id=str(cat.id),
        name=cat.name,
        description=cat.description,
        created_at=cat.created_at.isoformat() if cat.created_at else ""
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all project categories"""
    categories = db.query(ProjectCategory).order_by(ProjectCategory.name.asc()).all()
    return [_cat_to_response(c) for c in categories]


@router.post("", response_model=CategoryResponse)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Create a new project category (L1 Super Admin only)"""
    existing = db.query(ProjectCategory).filter(ProjectCategory.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with name '{payload.name}' already exists"
        )
    
    cat = ProjectCategory(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    log_audit(db, current_user.id, "create", "project_category", cat.id, request)
    return _cat_to_response(cat)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Update a project category (L1 Super Admin only)"""
    cat = db.query(ProjectCategory).filter(ProjectCategory.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
        
    if payload.name is not None:
        name_clean = payload.name.strip()
        if name_clean != cat.name:
            existing = db.query(ProjectCategory).filter(ProjectCategory.name == name_clean).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with name '{name_clean}' already exists"
                )
            cat.name = name_clean
            
    if payload.description is not None:
        cat.description = payload.description.strip() if payload.description else None
        
    db.commit()
    db.refresh(cat)
    
    log_audit(db, current_user.id, "update", "project_category", cat.id, request)
    return _cat_to_response(cat)


@router.delete("/{category_id}")
async def delete_category(
    category_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Delete a project category (L1 Super Admin only)"""
    cat = db.query(ProjectCategory).filter(ProjectCategory.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
        
    # Prevent deleting the fallback 'General' category
    if cat.name == "General":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The default 'General' category cannot be deleted."
        )
        
    # Get or create General category for fallback
    general_cat = db.query(ProjectCategory).filter(ProjectCategory.name == "General").first()
    if not general_cat:
        # Create it if somehow deleted or missing
        general_cat = ProjectCategory(name="General", description="Default category for General")
        db.add(general_cat)
        db.commit()
        db.refresh(general_cat)

    # Re-assign projects pointing to this category to General
    from app.models.project import Project
    db.query(Project).filter(Project.category_id == cat.id).update({Project.category_id: general_cat.id})
    
    db.delete(cat)
    db.commit()
    
    log_audit(db, current_user.id, "delete", "project_category", category_id, request)
    return {"message": "Category deleted successfully"}
