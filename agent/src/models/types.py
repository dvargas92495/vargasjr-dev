from enum import Enum
from typing import Literal
from vellum.core.pydantic_utilities import UniversalBaseModel


class InboxType(str, Enum):
    FORM = "FORM"
    EMAIL = "EMAIL"
    TEXT = "TEXT"


class InboxMessageOperationType(str, Enum):
    READ = "READ"
    ARCHIVED = "ARCHIVED"


Sport = Literal[
    "MLB",
    "NBA",
    "NFL",
    "NCAAB",
]


class TeamEspnData(UniversalBaseModel):
    espn_id: str
    espn_sport: str
    espn_league: str


class Team(UniversalBaseModel):
    location: str
    name: str
    espn_data: TeamEspnData
    sport: Sport

    @property
    def full_name(self) -> str:
        return f"{self.location} {self.name}"
