from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str = "change-me-in-production-make-it-long-and-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth (for Drive + optional SSO)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # CORS — set to your Vercel URL in production
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP Settings (optional, falls back to mock console logs)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@workhive.com"
    RESEND_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    BREVO_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()

# Normalize DATABASE_URL for driver compatibility
if settings.DATABASE_URL.startswith("mysql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)
elif settings.DATABASE_URL.startswith("postgres://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)
