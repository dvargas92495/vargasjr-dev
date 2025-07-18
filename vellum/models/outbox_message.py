from datetime import datetime, UTC
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from models.types import InboxType


class OutboxMessage(SQLModel, table=True):
    __tablename__ = "outbox_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    parent_inbox_message_id: UUID = Field(sa_column_kwargs={"name": "parent_inbox_message_id"})
    body: str
    thread_id: Optional[str] = Field(default=None, sa_column_kwargs={"name": "thread_id"})
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
    type: InboxType
