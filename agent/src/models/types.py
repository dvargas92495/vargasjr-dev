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


class Sport(str, Enum):
    MLB = "MLB"
    NBA = "NBA"
    NFL = "NFL"
    NCAAB = "NCAAB"


class TeamEspnData(UniversalBaseModel):
    espn_id: str
    espn_sport: str
    espn_league: str
