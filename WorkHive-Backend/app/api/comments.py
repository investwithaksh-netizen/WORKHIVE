from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import List
from app.core.database import get_db
from app.models.task_comment import TaskComment
from app.models.task import Task
from app.models.user import User, UserRole
from app.api.auth import get_current_user
from app.api.tasks import _assert_project_access

router = APIRouter(prefix="/api/v1/tasks", tags=["comments"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    body: str


class CommentUpdate(BaseModel):
    body: str


class CommentResponse(BaseModel):
    id: str
    task_id: str
    author_id: str
    author_name: str
    body: str
    created_at: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/{task_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    task_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify project access
    _assert_project_access(task.project_id, current_user, db)

    # Perform outerjoin to load user names in a single database query (prevents N+1 queries)
    comments_with_users = db.query(TaskComment, User.full_name).outerjoin(
        User, TaskComment.author_id == User.id
    ).filter(
        TaskComment.task_id == task_id
    ).order_by(TaskComment.created_at).offset(skip).limit(limit).all()

    return [
        CommentResponse(
            id=str(c.id),
            task_id=str(c.task_id),
            author_id=str(c.author_id),
            author_name=full_name if full_name else "Unknown",
            body=c.body,
            created_at=c.created_at.isoformat()
        )
        for c, full_name in comments_with_users
    ]


@router.post("/{task_id}/comments", response_model=CommentResponse)
async def add_comment(
    task_id: uuid.UUID,
    comment: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify project access
    _assert_project_access(task.project_id, current_user, db)

    new_comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        body=comment.body
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Create notifications for comment activity
    from app.models.notification import Notification
    notified_users = {current_user.id}  # Avoid notifying comment author

    # Notify Assignee
    if task.assigned_to and task.assigned_to not in notified_users:
        db.add(Notification(
            user_id=task.assigned_to,
            type="comment_added",
            payload={
                "message": f"{current_user.full_name} commented on task '{task.title}'.",
                "link": f"/projects/{task.project_id}?task={task.id}"
            },
            is_read=False
        ))
        notified_users.add(task.assigned_to)

    # Notify Creator
    if task.created_by and task.created_by not in notified_users:
        db.add(Notification(
            user_id=task.created_by,
            type="comment_added",
            payload={
                "message": f"{current_user.full_name} commented on task '{task.title}'.",
                "link": f"/projects/{task.project_id}?task={task.id}"
            },
            is_read=False
        ))
    db.commit()

    return CommentResponse(
        id=str(new_comment.id),
        task_id=str(new_comment.task_id),
        author_id=str(new_comment.author_id),
        author_name=current_user.full_name,
        body=new_comment.body,
        created_at=new_comment.created_at.isoformat()
    )


@router.put("/{task_id}/comments/{comment_id}", response_model=CommentResponse)
async def edit_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify project access
    _assert_project_access(task.project_id, current_user, db)

    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task_id
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this comment"
        )

    comment.body = comment_update.body
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=str(comment.id),
        task_id=str(comment.task_id),
        author_id=str(comment.author_id),
        author_name=current_user.full_name,
        body=comment.body,
        created_at=comment.created_at.isoformat()
    )


@router.delete("/{task_id}/comments/{comment_id}")
async def delete_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Verify project access
    _assert_project_access(task.project_id, current_user, db)

    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task_id
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if current_user.role not in [UserRole.L1, UserRole.L2] and comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}
