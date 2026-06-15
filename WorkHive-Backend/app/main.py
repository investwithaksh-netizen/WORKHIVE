from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.files import router as files_router
from app.api.google_drive import router as google_drive_router
from app.api.projects import router as projects_router
from app.api.tasks import router as tasks_router
from app.api.comments import router as comments_router
from app.api.notifications import router as notifications_router
from app.api.audit import router as audit_router
from app.api.categories import router as categories_router
from app.api.templates import router as templates_router

app = FastAPI(
    title="WorkHive API",
    description="Secure project management platform for small businesses",
    version="1.0.0"
)

# CORS — allow the configured frontend URL (Vercel in production, localhost in dev)
frontend_url = settings.FRONTEND_URL.strip().rstrip("/")
origins = [
    "http://localhost:5173",
    frontend_url,
]

# Print CORS origins to console for debugging
print(f"CORS Allowed Origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),  # deduplicate
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(files_router)
app.include_router(google_drive_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(comments_router)
app.include_router(notifications_router)
app.include_router(audit_router)
app.include_router(categories_router)
app.include_router(templates_router)


@app.get("/")
async def root():
    return {"message": "WorkHive API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # Run a simple query to verify database connection health
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )
