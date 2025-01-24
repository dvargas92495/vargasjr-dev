from enum import Enum
from typing import Literal
from vellum.core.pydantic_utilities import UniversalBaseModel


class InboxType(str, Enum):
    FORM = "FORM"
    EMAIL = "EMAIL"
    TEXT = "TEXT"
    NONE = "NONE"


class InboxMessageOperationType(str, Enum):
    READ = "READ"
    ARCHIVED = "ARCHIVED"


class Sport(str, Enum):
    MLB = "MLB"
    NBA = "NBA"
    NFL = "NFL"
    NCAAB = "NCAAB"
