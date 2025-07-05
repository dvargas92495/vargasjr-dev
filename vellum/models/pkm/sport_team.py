from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel
from models.types import Sport


class SportTeam(SQLModel, table=True):
    __tablename__ = "sport_teams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    location: str
    name: str
    sport: Sport
    espn_id: str

    @property
    def full_name(self) -> str:
        return f"{self.location} {self.name}"
