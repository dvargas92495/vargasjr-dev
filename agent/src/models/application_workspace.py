from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4


class ApplicationWorkspace(SQLModel, table=True):
    __tablename__ = "application_workspaces"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    application_id: UUID = Field(foreign_key="applications.id")
    name: str
    workspace_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
