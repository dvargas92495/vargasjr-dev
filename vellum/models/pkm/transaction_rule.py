from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, String
from models.types import PersonalTransaction, PersonalTransactionCategory, Sport, TransactionRuleOperation


class TransactionRule(SQLModel, table=True):
    __tablename__ = "transaction_rules"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    category: PersonalTransactionCategory = Field(sa_type=String)
    operation: TransactionRuleOperation = Field(sa_type=String)
    target: str
    description: Optional[str]

    def matches(self, transaction: PersonalTransaction) -> bool:
        if self.operation == "CONTAINS":
            return self.target in transaction.description

        if self.operation == "EQUALS":
            return self.target == transaction.description

        return False
