"""
Seed script to create default admin user
Run: python seed_admin.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.core.security import get_password_hash


from app.models.organisation import Organisation


def create_admin_user():
    """Create default admin user if not exists"""
    db = SessionLocal()
    
    try:
        # Get or create default organisation
        default_org = db.query(Organisation).filter(Organisation.name == "WorkHive Workspace").first()
        if not default_org:
            default_org = Organisation(name="WorkHive Workspace")
            db.add(default_org)
            db.commit()
            db.refresh(default_org)
            print("Created default organisation: WorkHive Workspace")

        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@workhive.com").first()
        
        if existing_admin:
            print("Admin user already exists!")
            print(f"Email: admin@workhive.com")
            if not existing_admin.organisation_id:
                existing_admin.organisation_id = default_org.id
                db.commit()
                print("Assigned existing admin to default organisation.")
            return
        
        # Create admin user
        admin_user = User(
            email="admin@workhive.com",
            password_hash=get_password_hash("admin123"),
            full_name="Admin User",
            role=UserRole.L1,
            is_active=True,
            organisation_id=default_org.id
        )
        
        db.add(admin_user)
        db.commit()
        
        print("Default admin user created successfully!")
        print("Email: admin@workhive.com")
        print("Password: admin123")
        print("\nPlease change the password after first login!")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Create admin user
    create_admin_user()
