from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4


class Application(SQLModel, table=True):
    __tablename__ = "applications"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
