from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import timedelta
import re
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenExpiredError,
    TokenInvalidError
)
from app.core.config import settings
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Schemas ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[UserRole] = UserRole.L3

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[@$!%*?&_#^()\-+={}\[\]|\\:;\"'<>,./?~`]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """JSON body for token refresh — avoids exposing token in query params."""
    token: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool


class GoogleLoginRequest(BaseModel):
    credential: str


# ── Dependencies ───────────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenInvalidError:
        raise credentials_exception

    if payload.get("type") != "access":
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise credentials_exception

    # Ensure user has an organisation assigned
    if not user.organisation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to any organisation. Please contact an administrator."
        )

    return user


def require_role(allowed_roles: list[UserRole]):
    """Factory: returns a FastAPI dependency that enforces RBAC."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


def _build_user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse)
async def register(request: Request, user_data: UserRegister, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Get or create default organisation
    from app.models.organisation import Organisation
    default_org = db.query(Organisation).first()
    if not default_org:
        default_org = Organisation(name="WorkHive Workspace")
        db.add(default_org)
        db.commit()
        db.refresh(default_org)

    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=False,
        approval_status="pending",
        organisation_id=default_org.id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Log user registration
    from app.core.audit import log_audit
    log_audit(db, new_user.id, "register", "user", new_user.id, request)
    db.commit()

    # Send confirmation email to user
    from app.core.email import send_email
    user_subject = "Registration Request Received — WorkHive"
    user_body = f"""
    <p>Hello <strong>{new_user.full_name}</strong>,</p>
    <p>Thank you for registering with WorkHive. Your request to join as an <strong>{new_user.role.value.capitalize()}</strong> is currently pending administrator approval.</p>
    <p>You will receive an email confirmation once your account has been validated by an admin.</p>
    <p>Best regards,<br>The WorkHive Team</p>
    """
    background_tasks.add_task(send_email, new_user.email, user_subject, user_body)

    # Send alert email to admins
    admin_subject = f"New Account Validation Pending: {new_user.full_name}"
    admin_body = f"""
    <p>Hello Admin,</p>
    <p>A new user has registered and is waiting for validation:</p>
    <ul>
        <li><strong>Name:</strong> {new_user.full_name}</li>
        <li><strong>Email:</strong> {new_user.email}</li>
        <li><strong>Requested Role:</strong> {new_user.role.value.capitalize()}</li>
    </ul>
    <p>Please log in to the WorkHive dashboard and navigate to the Team tab to approve or reject this request.</p>
    """
    
    # Notify and email admins in the organisation
    admins = db.query(User).filter(User.role == UserRole.L1, User.organisation_id == default_org.id).all()
    from app.models.notification import Notification
    for admin in admins:
        # Create in-app notification
        db.add(Notification(
            user_id=admin.id,
            type="user_registration",
            payload={
                "message": f"Validation request: {new_user.full_name} ({new_user.email}) as {new_user.role.value.capitalize()}.",
                "link": "/team"
            },
            is_read=False
        ))
        # Send mail
        background_tasks.add_task(send_email, admin.email, admin_subject, admin_body)
    
    db.commit()

    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value,
        is_active=new_user.is_active
    )


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if user and user.auth_provider == "google" and user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please use the Google button to log in."
        )

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is pending administrator approval. You will receive an email once it is approved."
        )

    if user.approval_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your registration request was rejected. Please contact an administrator."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(data={"sub": user.email})

    # Log user login
    from app.core.audit import log_audit
    log_audit(db, user.id, "login", "user", user.id, request)
    db.commit()

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_build_user_dict(user)
    )


@router.post("/google", response_model=Token)
async def google_login(
    payload: GoogleLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google token: {str(e)}"
        )
    
    email = idinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token does not contain email"
        )
        
    full_name = idinfo.get("name", email.split("@")[0])
    
    # Find user or create
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Get or create default organisation
        from app.models.organisation import Organisation
        default_org = db.query(Organisation).first()
        if not default_org:
            default_org = Organisation(name="WorkHive Workspace")
            db.add(default_org)
            db.commit()
            db.refresh(default_org)

        user = User(
            email=email,
            password_hash=None,
            full_name=full_name,
            role=UserRole.L3,
            is_active=True,
            approval_status="approved",
            auth_provider="google",
            organisation_id=default_org.id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Log user registration via Google
        from app.core.audit import log_audit
        log_audit(db, user.id, "register", "user", user.id, request)
        db.commit()
            
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    if user.approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is pending administrator approval."
        )

    if user.approval_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your registration request was rejected."
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(data={"sub": user.email})

    # Log user login
    from app.core.audit import log_audit
    log_audit(db, user.id, "login", "user", user.id, request)
    db.commit()

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_build_user_dict(user)
    )


@router.post("/refresh", response_model=Token)
async def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Refresh access + refresh tokens.
    Accepts JSON body: { "token": "<refresh_token>" }
    """
    try:
        payload = decode_token(body.token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    except TokenInvalidError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    email: str = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=_build_user_dict(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the currently authenticated user. Used to hydrate client-side state."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        is_active=current_user.is_active
    )
