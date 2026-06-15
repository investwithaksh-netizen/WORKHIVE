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


DEFAULT_DATA = {
    "Business Development": [
        "Initial Outreach", "Follow-up Call", "Schedule Meeting", "Conduct Discovery Call",
        "Client Meeting", "Prepare Proposal", "Send Proposal", "Proposal Follow-up",
        "Negotiate Terms", "Client Onboarding", "Close Opportunity"
    ],
    "Client Delivery": [
        "Kick-off Meeting", "Weekly Review", "Progress Update", "Assign Task",
        "Quality Review", "Final Approval", "Project Closure"
    ],
    "Strategy & Advisory": [
        "Business Analysis", "Financial Analysis", "Market Research", "Competitor Research",
        "Prepare Strategy Report", "Review Business Plan", "Develop Action Plan", "Risk Assessment"
    ],
    "Fundraising": [
        "Prepare Investor Deck", "Update Financial Model", "Due Diligence",
        "Investor Meeting", "Share Investment Documents"
    ],
    "Finance": [
        "Prepare Financial Model", "Update Financial Model", "Review Financial Statements",
        "Cash Flow Analysis", "Budget Preparation"
    ],
    "Operations": [
        "Create SOP", "Review SOP", "Process Mapping", "Operational Review"
    ],
    "Marketing": [
        "Content Writing", "Content Review", "Social Media Post", "Campaign Planning", "Campaign Review"
    ],
    "Branding": [
        "Graphic Design", "Website Update", "SEO Optimization"
    ],
    "Technology": [
        "UI Design", "Feature Development", "Bug Fix", "Testing", "Deploy Update",
        "System Configuration", "Automation Setup"
    ],
    "Product Development": [
        "UI Design", "Feature Development", "Bug Fix", "Testing", "Deploy Update"
    ],
    "Legal & Compliance": [
        "Compliance Review", "Prepare Agreement", "Review Contract", "Registration Filing", "License Renewal"
    ],
    "Human Resources": [
        "Conduct Interview", "Employee Onboarding", "Performance Review",
        "Approve Leave", "Attendance Review", "Policy Update"
    ],
    "Administration": [
        "Research", "Documentation", "Data Collection", "Presentation Preparation",
        "Report Preparation", "Internal Discussion", "Miscellaneous"
    ],
    "Procurement": [
        "Vendor Evaluation", "Vendor Follow-up", "Procurement Planning"
    ],
    "Research": [
        "Research", "Documentation", "Data Collection", "Presentation Preparation",
        "Report Preparation", "Internal Discussion", "Miscellaneous"
    ],
    "Internal Projects": [
        "Kick-off Meeting", "Weekly Review", "Progress Update", "Assign Task",
        "Quality Review", "Final Approval", "Project Closure"
    ],
    "Events": [
        "Kick-off Meeting", "Weekly Review", "Progress Update", "Assign Task",
        "Quality Review", "Final Approval", "Project Closure"
    ],
    "General": [
        "Research", "Documentation", "Data Collection", "Presentation Preparation",
        "Report Preparation", "Internal Discussion", "Miscellaneous"
    ]
}


def seed_categories_and_templates():
    """Seed project categories and task templates"""
    from app.models.project_category import ProjectCategory
    from app.models.task_template import TaskTemplate
    db = SessionLocal()
    try:
        print("Seeding project categories and task templates...")
        for cat_name, templates in DEFAULT_DATA.items():
            cat = db.query(ProjectCategory).filter(ProjectCategory.name == cat_name).first()
            if not cat:
                cat = ProjectCategory(name=cat_name, description=f"Default category for {cat_name}")
                db.add(cat)
                db.commit()
                db.refresh(cat)
                print(f"Created category: {cat_name}")
            
            for t_title in templates:
                tpl = db.query(TaskTemplate).filter(
                    TaskTemplate.category_id == cat.id,
                    TaskTemplate.title == t_title
                ).first()
                if not tpl:
                    tpl = TaskTemplate(category_id=cat.id, title=t_title, description=f"Default template task for {t_title}")
                    db.add(tpl)
                    print(f"  Created template: '{t_title}' under '{cat_name}'")
        db.commit()
        print("Seeding project categories and task templates complete!")
    except Exception as e:
        print(f"Error seeding categories and templates: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Create admin user
    create_admin_user()

    # Seed categories and templates
    seed_categories_and_templates()
