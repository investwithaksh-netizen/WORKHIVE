from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api.auth import get_current_user, require_role
from app.core.config import settings

router = APIRouter(prefix="/api/v1/users", tags=["users"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/org", response_model=List[UserResponse])
async def get_org_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all active users in the current user's organisation.
    Used in task assignment dropdowns, team views, etc.
    """
    if not current_user.organisation_id:
        return []

    users = db.query(User).filter(
        User.organisation_id == current_user.organisation_id,
        User.is_active == True
    ).all()

    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    """
    Admin/Manager: list users.
    - Admins see all users across all orgs.
    - Managers see only users in their own org.
    """
    if current_user.role == UserRole.L1:
        users = db.query(User).offset(skip).limit(limit).all()
    else:
        users = db.query(User).filter(
            User.organisation_id == current_user.organisation_id
        ).offset(skip).limit(limit).all()

    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.get("/pending", response_model=List[UserResponse])
async def get_pending_users(
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Admin: list all users pending approval in the current admin's organisation."""
    users = db.query(User).filter(
        User.organisation_id == current_user.organisation_id,
        User.approval_status == "pending"
    ).all()
    
    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Non-admins can only view themselves or org members
    if (current_user.role not in [UserRole.L1, UserRole.L2]
            and current_user.id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1, UserRole.L2])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Only admins can change roles
    if user_update.role and current_user.role != UserRole.L1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change user roles"
        )

    if user_update.full_name:
        user.full_name = user_update.full_name
    if user_update.role:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    # Log user update
    from app.core.audit import log_audit
    action_type = "update"
    if user_update.role:
        action_type = "change_role"
    elif user_update.is_active is not None:
        action_type = "deactivate" if not user_update.is_active else "activate"
    log_audit(db, current_user.id, action_type, "user", user.id, request)

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.post("/{user_id}/approve")
async def approve_user(
    user_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Admin: approve user registration."""
    user = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.approval_status != "pending":
        raise HTTPException(status_code=400, detail="User is not pending approval")
        
    user.approval_status = "approved"
    user.is_active = True
    # Log user approval
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "approve", "user", user.id, request)

    db.commit()
    
    # Send email
    from app.core.email import send_email
    subject = "Account Approved — WorkHive"
    body = f"""
    <p>Hello <strong>{user.full_name}</strong>,</p>
    <p>We are pleased to inform you that your WorkHive account has been <strong>approved</strong> by the administrator.</p>
    <p>You can now log in to the dashboard using your registered email and password.</p>
    <p>Login URL: <a href="{settings.FRONTEND_URL}">{settings.FRONTEND_URL}</a></p>
    <p>Best regards,<br>The WorkHive Team</p>
    """
    background_tasks.add_task(send_email, user.email, subject, body)
    
    return {"message": "User approved successfully"}


@router.post("/{user_id}/reject")
async def reject_user(
    user_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """Admin: reject user registration."""
    user = db.query(User).filter(
        User.id == user_id,
        User.organisation_id == current_user.organisation_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.approval_status != "pending":
        raise HTTPException(status_code=400, detail="User is not pending approval")
        
    user.approval_status = "rejected"
    user.is_active = False
    # Log user rejection
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "reject", "user", user.id, request)

    db.commit()
    
    # Send email
    from app.core.email import send_email
    subject = "Account Registration Status Update — WorkHive"
    body = f"""
    <p>Hello <strong>{user.full_name}</strong>,</p>
    <p>Thank you for your interest in WorkHive.</p>
    <p>Unfortunately, your request to register an account has been <strong>rejected</strong> by the administrator.</p>
    <p>If you believe this was an error, please contact your workspace administrator.</p>
    <p>Best regards,<br>The WorkHive Team</p>
    """
    background_tasks.add_task(send_email, user.email, subject, body)
    
    return {"message": "User registration request rejected"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # Log user deletion
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "delete", "user", user.id, request)

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
