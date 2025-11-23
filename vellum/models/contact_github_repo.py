from datetime import datetime, UTC
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field


class ContactGithubRepo(SQLModel, table=True):
    __tablename__ = "contact_github_repos"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    contact_id: UUID = Field(foreign_key="contacts.id")
    repo_owner: str
    repo_name: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "updated_at"},
    )
