from datetime import datetime, UTC
from enum import Enum
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field

from models.types import InboxMessageOperationType


class InboxMessageOperation(SQLModel, table=True):
    __tablename__ = "inbox_message_operations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    inbox_message_id: UUID = Field(sa_column_kwargs={"name": "inbox_message_id"})
    operation: InboxMessageOperationType
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
