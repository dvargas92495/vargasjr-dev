from datetime import datetime, UTC
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field


class RoutineJob(SQLModel, table=True):
    __tablename__ = "routine_jobs"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    cron_expression: str
    enabled: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column_kwargs={"name": "created_at"},
    )
