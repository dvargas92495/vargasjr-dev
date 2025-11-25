from datetime import datetime, UTC
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from enum import Enum


class JobStatus(str, Enum):
    OPEN = "OPEN"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"


class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: Optional[str] = None
    due_date: datetime
    priority: float
    contact_id: Optional[UUID] = None
    status: JobStatus = Field(default=JobStatus.OPEN)
    reason: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
