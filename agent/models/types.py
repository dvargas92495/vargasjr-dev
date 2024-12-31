from enum import Enum


class InboxType(str, Enum):
    FORM = "FORM"
    EMAIL = "EMAIL"
    TEXT = "TEXT"
