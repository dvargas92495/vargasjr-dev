from datetime import datetime, UTC
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field


class InboxMessage(SQLModel, table=True):
    __tablename__ = "inbox_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    inbox_id: UUID = Field(sa_column_kwargs={"name": "inbox_id"})
    source: str
    body: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
