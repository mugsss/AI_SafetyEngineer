"""workflow webhooks and user app settings

Revision ID: 5b2a1c0d9e4f
Revises: 4c7533eeb243
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5b2a1c0d9e4f"
down_revision: Union[str, None] = "4c7533eeb243"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_app_settings",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "workflow_webhooks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("secret", sa.String(length=512), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workflow_webhooks_user_id"),
        "workflow_webhooks",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_workflow_webhooks_user_id"), table_name="workflow_webhooks")
    op.drop_table("workflow_webhooks")
    op.drop_table("user_app_settings")
