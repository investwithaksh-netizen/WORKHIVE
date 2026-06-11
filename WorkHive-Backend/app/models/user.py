from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
import enum
from app.core.database import Base


class UserRole(enum.Enum):
    CLIENT = "client"
    L3 = "L3"
    L2 = "L2"
    L1 = "L1"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    auth_provider = Column(String(50), default="local", server_default="local", nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.L3)
    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(String(50), default="approved", server_default="approved", nullable=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    organisation_id = Column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=True)
    # Google Drive OAuth tokens
    google_drive_token = Column(Text, nullable=True)
    google_drive_refresh_token = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    organisation = relationship("Organisation", back_populates="users")
