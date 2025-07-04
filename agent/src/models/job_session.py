from datetime import datetime, UTC
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field


class JobSession(SQLModel, table=True):
    __tablename__ = "job_sessions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    job_id: UUID = Field(foreign_key="jobs.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
    end_at: Optional[datetime] = Field(
        default=None,
        sa_column_kwargs={"name": "end_at"},
    )
