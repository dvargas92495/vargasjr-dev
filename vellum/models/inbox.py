from datetime import datetime, UTC
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field

from models.types import InboxType


class Inbox(SQLModel, table=True):
    __tablename__ = "inboxes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    display_label: str | None = Field(default=None, sa_column_kwargs={"name": "display_label"})
    type: InboxType
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
