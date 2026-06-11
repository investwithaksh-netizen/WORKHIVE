"""rename_roles_to_l1_l2_l3

Revision ID: 23044d664992
Revises: 828705d66d1b
Create Date: 2026-06-11 12:31:49.381928

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '23044d664992'
down_revision = '828705d66d1b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Alter the column to include both old and new enum values to avoid constraint violations
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('client', 'employee', 'manager', 'admin', 'L3', 'L2', 'L1') NOT NULL DEFAULT 'L3'")

    # 2. Update existing data
    op.execute("UPDATE users SET role = 'L1' WHERE role = 'admin'")
    op.execute("UPDATE users SET role = 'L2' WHERE role = 'manager'")
    op.execute("UPDATE users SET role = 'L3' WHERE role = 'employee'")

    # 3. Alter the column to only contain the new enum values
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('client', 'L3', 'L2', 'L1') NOT NULL DEFAULT 'L3'")


def downgrade() -> None:
    # 1. Alter the column to include both old and new enum values
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('client', 'employee', 'manager', 'admin', 'L3', 'L2', 'L1') NOT NULL DEFAULT 'employee'")

    # 2. Revert the data
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'L1'")
    op.execute("UPDATE users SET role = 'manager' WHERE role = 'L2'")
    op.execute("UPDATE users SET role = 'employee' WHERE role = 'L3'")

    # 3. Alter the column to only contain the old enum values
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('client', 'employee', 'manager', 'admin') NOT NULL DEFAULT 'employee'")
