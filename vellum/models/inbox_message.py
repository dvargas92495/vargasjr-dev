from datetime import datetime, UTC
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class InboxMessage(SQLModel, table=True):
    __tablename__ = "inbox_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    inbox_id: UUID = Field(sa_column_kwargs={"name": "inbox_id"})
    contact_id: UUID = Field(sa_column_kwargs={"name": "contact_id"})
    body: str
    thread_id: Optional[str] = Field(default=None, sa_column_kwargs={"name": "thread_id"})
    external_id: Optional[str] = Field(default=None, sa_column_kwargs={"name": "external_id"})
    message_metadata: Optional[dict[str, Any]] = Field(default=None, sa_column=Column("metadata", JSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
