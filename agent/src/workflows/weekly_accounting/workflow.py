from datetime import datetime, timedelta
import os
from typing import List
import requests
from src.services.google_sheets import get_spreadsheets, prepend_rows
from vellum import ChatMessagePromptBlock, PlainTextPromptBlock, RichTextPromptBlock
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, InlinePromptNode
from vellum.workflows.types import MergeBehavior


SPREADSHEET_ID = "1azbspgulxIEW7YSMFgscFm7GEJkSQIS3S_6cq60E4hw"


def to_dollar_float(value: str) -> float:
    return float(value.replace("$", "").replace(",", ""))


class Transaction(UniversalBaseModel):
    date: datetime
    source: str
    description: str
    amount: float
    category: str
    notes: str


class BuildPersonalFinancialContext(BaseNode):
    # TODO: Here we'll get data from our sheets to build a context object for further classification
    pass


class GetCreditCardTransactions(BaseNode):
    class Outputs(BaseNode.Outputs):
        transactions: List[Transaction]
        snapshot: float

    def run(self) -> Outputs:
        # TODO: Use external Inputs here to text me and ask for Venmo screenshots
        return self.Outputs(
            transactions=[],
            snapshot=-2000.0,
        )


class GetBankTransactions(BaseNode):
    class Outputs(BaseNode.Outputs):
        transactions: List[Transaction]
        snapshot: float

    def run(self) -> Outputs:
        mercury_api_token = os.getenv("MERCURY_API_TOKEN")
        if not mercury_api_token:
            raise ValueError("MERCURY_API_TOKEN environment variable not set")

        headers = {"Authorization": f"Bearer {mercury_api_token}"}

        accounts_url = "https://api.mercury.com/api/v1/accounts"
        accounts_response = requests.get(accounts_url, headers=headers)
        accounts_response.raise_for_status()
        accounts = accounts_response.json()["accounts"]
        checking_account_id = next(account["id"] for account in accounts if account["kind"] == "checking")

        today_date = datetime.now()
        last_week_date = today_date - timedelta(days=7)
        transactions_url = f"https://api.mercury.com/api/v1/account/{checking_account_id}/transactions"
        params = {
            "start": last_week_date.strftime("%Y-%m-%d"),
            "end": today_date.strftime("%Y-%m-%d"),
        }
        transactions_response = requests.get(transactions_url, headers=headers, params=params)
        transactions_response.raise_for_status()
        transactions = transactions_response.json()["transactions"]

        return self.Outputs(
            transactions=[
                Transaction(
                    date=datetime.fromisoformat(transaction["postedAt"] or transaction["createdAt"]),
                    source="Mercury Checking",
                    description=transaction["bankDescription"],
                    amount=transaction["amount"],
                    category="Family Fund Deposit",
                    notes="PENDING" if transaction["status"] == "pending" else "",
                )
                for transaction in transactions
            ],
            snapshot=8000.0,
        )


class UpdateFinances(BaseNode):
    credit_card_snapshot = GetCreditCardTransactions.Outputs.snapshot
    bank_snapshot = GetBankTransactions.Outputs.snapshot
    credit_card_transactions = GetCreditCardTransactions.Outputs.transactions
    bank_transactions = GetBankTransactions.Outputs.transactions

    class Trigger(BaseNode.Trigger):
        merge_behavior = MergeBehavior.AWAIT_ALL

    class Outputs(BaseNode.Outputs):
        transactions_added: int

    def run(self) -> Outputs:
        date = datetime.now().strftime("%m/%d/%Y")
        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            sheet_name="Snapshots",
            rows=[
                [date, "Mercury Checking", self.bank_snapshot],
                [date, "Venmo Credit Card", self.credit_card_snapshot],
            ],
        )

        sorted_transactions = sorted(
            self.credit_card_transactions + self.bank_transactions, key=lambda x: x.date, reverse=True
        )

        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            sheet_name="Transactions",
            rows=[
                [t.date.strftime("%m/%d/%Y"), t.source, t.description, t.amount, t.category, t.notes]
                for t in sorted_transactions
            ],
        )

        return self.Outputs(transactions_added=len(sorted_transactions))


class Snapshot(UniversalBaseModel):
    source: str
    snapshot: float


class Category(UniversalBaseModel):
    category: str
    amount: float
    start_date: datetime
    end_date: datetime


class FinancialSummary(UniversalBaseModel):
    snapshots: list[Snapshot]
    categories: list[Category]
    transactions_added: int


class GetSummaryData(BaseNode):
    transactions_added = UpdateFinances.Outputs.transactions_added

    class Outputs(BaseNode.Outputs):
        data: str

    def run(self) -> Outputs:
        sheets = get_spreadsheets()

        snapshot_data = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range="Summary!A54:B57").execute()["values"]
        snapshots = [
            Snapshot(source=snapshot[0], snapshot=to_dollar_float(snapshot[1])) for snapshot in snapshot_data[1:]
        ]

        category_data = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range="Summary!A1:D51").execute()["values"]
        categories = [
            Category(
                category="Self",
                amount=to_dollar_float(category_data[1][3]),
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 1, 31),
            ),
            Category(
                category="Self",
                amount=to_dollar_float(category_data[1][2]),
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 12, 31),
            ),
            Category(
                category="Total",
                amount=to_dollar_float(category_data[50][3]),
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 1, 31),
            ),
            Category(
                category="Total",
                amount=to_dollar_float(category_data[50][2]),
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 12, 31),
            ),
        ]

        return self.Outputs(
            data=FinancialSummary(
                snapshots=snapshots,
                categories=categories,
                transactions_added=self.transactions_added,
            ).model_dump_json(indent=2)
        )


class SummarizeData(InlinePromptNode):
    prompt_inputs = {}
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="""\
You are my personal financial assistant. Below is a JSON object with the summary of my financial data \
and you're going to write the body of the email that contains all of the data in a digestible format. \
Feel free to include any humor, personality, and optimism you see fit. When you sign off, your name is \
"Vargas JR". When you do breakdowns, DO NOT add commentary on each bullet, save it for after the bullets. \
"""
                        ),
                        PlainTextPromptBlock(text=GetSummaryData.Outputs.data),
                    ]
                )
            ],
        )
    ]


class SendFinancesReport(BaseNode):
    message = SummarizeData.Outputs.text

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        # TODO: Send message as email
        return self.Outputs(summary=self.message)


class WeeklyAccountingWorkflow(BaseWorkflow):
    graph = (
        BuildPersonalFinancialContext
        >> {
            GetCreditCardTransactions,
            GetBankTransactions,
        }
        >> UpdateFinances
        >> GetSummaryData
        >> SummarizeData
        >> SendFinancesReport
    )

    class Outputs(BaseWorkflow.Outputs):
        summary = SendFinancesReport.Outputs.summary
