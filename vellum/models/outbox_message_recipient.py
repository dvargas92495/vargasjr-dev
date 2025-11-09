from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from models.types import OutboxRecipientType


class OutboxMessageRecipient(SQLModel, table=True):
    __tablename__ = "outbox_message_recipients"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    message_id: UUID = Field(sa_column_kwargs={"name": "message_id"})
    contact_id: UUID = Field(sa_column_kwargs={"name": "contact_id"})
    type: OutboxRecipientType
