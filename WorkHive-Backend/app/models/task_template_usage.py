from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class TaskTemplateUsage(Base):
    __tablename__ = "task_template_usages"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("task_templates.id", ondelete="CASCADE"), primary_key=True, index=True)
    usage_count = Column(Integer, default=0, nullable=False)
    last_used_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
    template = relationship("TaskTemplate")
