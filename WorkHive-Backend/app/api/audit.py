from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.api.auth import require_role

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: str


class AuditLogPaginatedResponse(BaseModel):
    total: int
    logs: List[AuditLogResponse]


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=AuditLogPaginatedResponse)
async def list_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role([UserRole.L1])),
    db: Session = Depends(get_db)
):
    """
    Get paginated and filterable audit logs. Only accessible by workspace Administrators.
    Joins the user table to get the full name and email of the actor.
    """
    query = db.query(AuditLog, User).join(User, AuditLog.user_id == User.id)

    # Only show logs within the admin's organisation to maintain security isolation
    query = query.filter(User.organisation_id == current_user.organisation_id)

    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            query = query.filter(AuditLog.user_id == user_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id UUID")

    if action:
        query = query.filter(AuditLog.action == action)

    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    total = query.count()

    logs_with_users = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    return AuditLogPaginatedResponse(
        total=total,
        logs=[
            AuditLogResponse(
                id=str(log.id),
                user_id=str(log.user_id),
                user_name=user.full_name,
                user_email=user.email,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=str(log.resource_id) if log.resource_id else None,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at.isoformat()
            )
            for log, user in logs_with_users
        ]
    )
