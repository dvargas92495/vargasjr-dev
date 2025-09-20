from datetime import datetime
from enum import Enum
from typing import Literal, Set, cast, get_args
import pydantic
from vellum.core.pydantic_utilities import UniversalBaseModel


class InboxType(str, Enum):
    FORM = "FORM"
    EMAIL = "EMAIL"
    SMS = "SMS"
    SLACK = "SLACK"
    CHAT_SESSION = "CHAT_SESSION"
    NONE = "NONE"


class InboxMessageOperationType(str, Enum):
    READ = "READ"
    ARCHIVED = "ARCHIVED"
    UNREAD = "UNREAD"


class Sport(str, Enum):
    MLB = "MLB"
    NBA = "NBA"
    NFL = "NFL"
    NCAAB = "NCAAB"

class SportBroker(str, Enum):
    FANDUEL = "FanDuel"
    HARDROCKBET = "Hard Rock Bet"
    PARLAYPARTAY = "Parlay Partay"


PersonalTransactionSource = Literal[
    "Mercury Checking",
    "Venmo Credit",
    "Capital One Checking",
]

PersonalTransactionCategory = Literal[
    "Vehicle for Personal",
    "Residential Parking",
    "Commercial Parking",
    "Commercial Transportation",
    "Personal Transportation",
    "Health Insurance",
    "Medical Bills",
    "Dental Insurance",
    "Fitness",
    "Health goods",
    "Food & Drink",
    "Entertainment",
    "Hobby",
    "Financial Services",
    "Clothing",
    "Laundry",
    "Hair",
    "Family Fund Deposit",
    "Family Loan Repayment",
    "Housing",
    "Furniture",
    "Home Supplies",
    "Utilities",
    "Marriage",
    "Vacation",
    "Experience",
    "Gift",
    "Employment Income",
    "Socials",
    "Equipment",
    "Reimbursable Business Expense",
    "Business Investment",
    "Charity",
    "Federal Tax Payment",
    "Federal Tax Return",
    "Civil Income",
    "Fines",
]

PERSONAL_TRANSACTION_CATEGORIES: Set[PersonalTransactionCategory] = set(get_args(PersonalTransactionCategory))


class PersonalTransaction(UniversalBaseModel):
    date: datetime = pydantic.Field(description="Must be in ISO format (YYYY-MM-DD)")
    source: PersonalTransactionSource
    description: str
    amount: float
    category: PersonalTransactionCategory
    notes: str

    @pydantic.model_validator(mode="before")
    @classmethod
    def validate_model(cls, data: dict) -> dict:
        if data.get("category") not in PERSONAL_TRANSACTION_CATEGORIES:
            data["category"] = "Financial Services"
        return data


TransactionRuleOperation = Literal["EQUALS", "CONTAINS"]


class User(UniversalBaseModel):
    name: str
    email: str


USER = User(
    name="David Vargas",
    email="dvargas92495@gmail.com",
)
