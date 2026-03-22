"""analysis_runs.custom_agents JSON

Revision ID: 6c0d1e2f3a4b
Revises: 5b2a1c0d9e4f
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6c0d1e2f3a4b"
down_revision: Union[str, None] = "5b2a1c0d9e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analysis_runs",
        sa.Column("custom_agents", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_runs", "custom_agents")
