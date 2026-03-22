"""code graph and index metadata on safety_reports

Revision ID: 6f8a2b1c0d4e
Revises: 5b2a1c0d9e4f
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f8a2b1c0d4e"
down_revision: Union[str, None] = "5b2a1c0d9e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "safety_reports",
        sa.Column("code_graph", sa.JSON(), nullable=True),
    )
    op.add_column(
        "safety_reports",
        sa.Column("code_index_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "safety_reports",
        sa.Column("code_index_error", sa.String(length=2000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("safety_reports", "code_index_error")
    op.drop_column("safety_reports", "code_index_status")
    op.drop_column("safety_reports", "code_graph")
