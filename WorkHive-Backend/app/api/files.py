from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Request
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.gcs import drive_service
from app.models.file import File
from app.models.user import User
from app.api.auth import get_current_user
from app.models.user import UserRole
from app.api.tasks import _assert_project_access

router = APIRouter(prefix="/api/v1/files", tags=["files"])


# Schemas
class FileResponse(BaseModel):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    is_malware_scanned: bool
    created_at: str
    download_url: Optional[str] = None


@router.post("/upload", response_model=FileResponse)
async def upload_file(
    project_id: uuid.UUID,
    request: Request,
    task_id: Optional[uuid.UUID] = None,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforce project IAM permission (must be editor or manager)
    _assert_project_access(project_id, current_user, db, required_role="editor")

    # Check if user has Google Drive connected
    if not current_user.google_drive_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please connect your Google Drive account first"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Upload to Google Drive
    drive_file_id = drive_service.upload_file(
        file_data=file_content,
        filename=file.filename,
        content_type=file.content_type,
        access_token=current_user.google_drive_token,
        refresh_token=current_user.google_drive_refresh_token,
        db=db,
        user=current_user
    )
    
    # Create file record in database
    new_file = File(
        project_id=project_id,
        task_id=task_id,
        uploaded_by=current_user.id,
        filename=file.filename,
        drive_file_id=drive_file_id,
        mime_type=file.content_type,
        size_bytes=len(file_content),
        is_malware_scanned=False
    )
    
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    # Get download URL
    download_url = drive_service.get_download_url(
        drive_file_id,
        current_user.google_drive_token,
        current_user.google_drive_refresh_token,
        db=db,
        user=current_user
    )
    
    # Log file upload
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "upload", "file", new_file.id, request)
    db.commit()
    
    return FileResponse(
        id=str(new_file.id),
        filename=new_file.filename,
        mime_type=new_file.mime_type,
        size_bytes=new_file.size_bytes,
        is_malware_scanned=new_file.is_malware_scanned,
        created_at=new_file.created_at.isoformat(),
        download_url=download_url
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_record = db.query(File).filter(File.id == file_id).first()
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
        
    # Enforce project IAM permission (must be viewer)
    _assert_project_access(file_record.project_id, current_user, db)
    
    # Look up the uploader to use their Google Drive token
    uploader = db.query(User).filter(User.id == file_record.uploaded_by).first()
    uploader_token = uploader.google_drive_token if uploader else None
    uploader_refresh = uploader.google_drive_refresh_token if uploader else None
    
    if not uploader_token:
        uploader_token = current_user.google_drive_token
        uploader_refresh = current_user.google_drive_refresh_token
        
    if not uploader_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please connect your Google Drive account first"
        )
    
    # Get download URL
    download_url = drive_service.get_download_url(
        file_record.drive_file_id,
        uploader_token,
        uploader_refresh,
        db=db,
        user=uploader if uploader else current_user
    )
    
    return FileResponse(
        id=str(file_record.id),
        filename=file_record.filename,
        mime_type=file_record.mime_type,
        size_bytes=file_record.size_bytes,
        is_malware_scanned=file_record.is_malware_scanned,
        created_at=file_record.created_at.isoformat(),
        download_url=download_url
    )


@router.get("/project/{project_id}", response_model=List[FileResponse])
async def get_project_files(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforce project IAM permission (must be viewer)
    _assert_project_access(project_id, current_user, db)

    files = db.query(File).filter(File.project_id == project_id).all()
    
    file_responses = []
    for f in files:
        # Find the uploader to get their Google Drive token
        uploader = db.query(User).filter(User.id == f.uploaded_by).first()
        uploader_token = uploader.google_drive_token if uploader else None
        uploader_refresh = uploader.google_drive_refresh_token if uploader else None
        
        if not uploader_token:
            uploader_token = current_user.google_drive_token
            uploader_refresh = current_user.google_drive_refresh_token
            
        download_url = None
        if uploader_token:
            try:
                download_url = drive_service.get_download_url(
                    f.drive_file_id,
                    uploader_token,
                    uploader_refresh,
                    db=db,
                    user=uploader if uploader else current_user
                )
            except Exception:
                pass
                
        file_responses.append(
            FileResponse(
                id=str(f.id),
                filename=f.filename,
                mime_type=f.mime_type,
                size_bytes=f.size_bytes,
                is_malware_scanned=f.is_malware_scanned,
                created_at=f.created_at.isoformat(),
                download_url=download_url
            )
        )
    return file_responses


@router.delete("/{file_id}")
async def delete_file(
    file_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_record = db.query(File).filter(File.id == file_id).first()
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Enforce project IAM permission (must be viewer to delete, plus write check below)
    _assert_project_access(file_record.project_id, current_user, db)
    
    # Check if user is the uploader, has project manager access, or is admin/manager role
    is_project_manager = False
    if current_user.role not in [UserRole.L1, UserRole.L2]:
        from app.models.project_access import ProjectAccess
        access = db.query(ProjectAccess).filter(
            ProjectAccess.project_id == file_record.project_id,
            ProjectAccess.user_id == current_user.id
        ).first()
        if access and access.role.value == "manager":
            is_project_manager = True

    if (file_record.uploaded_by != current_user.id and 
        current_user.role not in [UserRole.L1, UserRole.L2] and
        not is_project_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this file"
        )
    
    # Look up the uploader to use their Google Drive token for deletion
    uploader = db.query(User).filter(User.id == file_record.uploaded_by).first()
    uploader_token = uploader.google_drive_token if uploader else None
    uploader_refresh = uploader.google_drive_refresh_token if uploader else None
    
    if not uploader_token:
        uploader_token = current_user.google_drive_token
        uploader_refresh = current_user.google_drive_refresh_token
        
    if not uploader_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Google Drive token found to delete this file"
        )
    
    # Delete from Google Drive
    drive_service.delete_file(
        file_record.drive_file_id,
        uploader_token,
        uploader_refresh,
        db=db,
        user=uploader if uploader else current_user
    )
    
    # Log file deletion
    from app.core.audit import log_audit
    log_audit(db, current_user.id, "delete", "file", file_record.id, request)
    
    # Delete from database
    db.delete(file_record)
    db.commit()
    
    return {"message": "File deleted successfully"}
