from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel


class SportGame(SQLModel, table=True):
    __tablename__ = "sport_games"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    home_team_id: UUID = Field(foreign_key="sport_teams.id")
    away_team_id: UUID = Field(foreign_key="sport_teams.id")
    home_team_score: int
    away_team_score: int
    start_time: datetime
    end_time: datetime

    class Config:
        table = True
        json_schema_extra = {
            "unique_together": [("start_time", "home_team_id", "away_team_id")]
        }
