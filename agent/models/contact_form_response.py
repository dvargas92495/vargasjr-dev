from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


class ContactFormResponse(SQLModel, table=True):
    __tablename__ = "contact_form_responses"

    id: int = Field(default=None, primary_key=True)
    form_id: str = Field(sa_column_kwargs={"name": "form_id"})
    email: str
    message: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
