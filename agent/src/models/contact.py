from datetime import datetime, UTC
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field


class Contact(SQLModel, table=True):
    __tablename__ = "contacts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: Optional[str] = None
    phone_number: Optional[str] = None
    full_name: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )

    @property
    def identifier(self) -> str:
        if self.full_name:
            return self.full_name
        elif self.email:
            return self.email
        elif self.phone_number:
            return self.phone_number
        else:
            return str(self.id)
