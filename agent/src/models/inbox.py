from datetime import datetime, UTC
from enum import Enum
from typing import Any
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from sqlalchemy.dialects.postgresql import JSONB

from src.models.types import InboxType


class Inbox(SQLModel, table=True):
    __tablename__ = "inboxes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    type: InboxType
    config: dict[str, Any] = Field(
        default_factory=dict,
        sa_type=JSONB,  # Use PostgreSQL's JSONB type
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
