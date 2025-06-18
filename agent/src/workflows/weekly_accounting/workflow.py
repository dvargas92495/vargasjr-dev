import base64
from datetime import datetime, timedelta, timezone
import json
import logging
import os
import boto3
from typing import List
import requests
from src.models.types import PERSONAL_TRANSACTION_CATEGORIES, USER, PersonalTransaction
from src.services import add_transaction_rule, get_all_transaction_rules, to_dollar_float
from src.services.aws import list_attachments_since, send_email
from src.services.google_sheets import get_spreadsheets, prepend_rows
from vellum import (
    ChatMessagePromptBlock,
    ImagePromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
)
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, InlinePromptNode
from vellum.workflows.types import MergeBehavior

SPREADSHEET_ID = "1azbspgulxIEW7YSMFgscFm7GEJkSQIS3S_6cq60E4hw"


class BuildPersonalFinancialContext(BaseNode):
    # TODO: Here we'll get data from our sheets to build a context object for further classification
    pass


class GetVenmoScreenshots(BaseNode):
    class Outputs(BaseNode.Outputs):
        image_blocks: list[ImagePromptBlock]

    def run(self) -> Outputs:
        logger: logging.Logger = getattr(self._context, "logger")

        session = boto3.Session()
        s3 = session.client("s3")
        image_blocks = []
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=6)
        attachments = list_attachments_since(cutoff_date)

        for attachment in attachments:
            response = s3.get_object(Bucket="vargas-jr-inbox", Key=attachment)
            image_data = response["Body"].read()
            content_type = response["ContentType"]

            b64_data = base64.b64encode(image_data).decode()
            data_url = f"data:{content_type};base64,{b64_data}"

            # Create image block
            image_blocks.append(ImagePromptBlock(src=data_url))

        logger.info(f"Found {len(image_blocks)} attachments...")

        del s3
        del session

        return self.Outputs(image_blocks=image_blocks)


class ParseVenmoOutput(UniversalBaseModel):
    transactions: list[PersonalTransaction]
    credit_balance: float


class ParseVenmoScreenshots(InlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="Parse the set of Venmo screenshots and return a list of transactions and the current credit balance."
                        ),
                    ]
                )
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=GetVenmoScreenshots.Outputs.image_blocks,
        ),
    ]
    parameters = PromptParameters(
        max_tokens=8000,
        custom_parameters={
            "json_schema": {
                "name": "venmo_output",
                "schema": ParseVenmoOutput.model_json_schema(),
            },
        },
    )


class GetCreditCardTransactions(BaseNode):
    prompt_text = ParseVenmoScreenshots.Outputs.text

    class Outputs(BaseNode.Outputs):
        transactions: List[PersonalTransaction]
        snapshot: float

    def run(self) -> Outputs:
        data = ParseVenmoOutput.model_validate_json(self.prompt_text)
        for transaction in data.transactions:
            transaction.amount = -transaction.amount

        return self.Outputs(
            transactions=data.transactions,
            snapshot=data.credit_balance,
        )


class GetBankTransactions(BaseNode):
    class Outputs(BaseNode.Outputs):
        transactions: List[PersonalTransaction]
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
        checking_account = next(account for account in accounts if account["kind"] == "checking")
        checking_account_id = checking_account["id"]
        checking_account_balance = checking_account["currentBalance"]

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
                PersonalTransaction(
                    date=datetime.fromisoformat(transaction["postedAt"] or transaction["createdAt"]),
                    source="Mercury Checking",
                    description=transaction["bankDescription"],
                    amount=transaction["amount"],
                    category="Family Fund Deposit",
                    notes="PENDING" if transaction["status"] == "pending" else "",
                )
                for transaction in transactions
            ],
            snapshot=checking_account_balance,
        )


class NormalizePersonalTransactions(BaseNode):
    credit_card_transactions = GetCreditCardTransactions.Outputs.transactions
    bank_transactions = GetBankTransactions.Outputs.transactions

    class Trigger(BaseNode.Trigger):
        merge_behavior = MergeBehavior.AWAIT_ALL

    class Outputs(BaseNode.Outputs):
        transactions: list[PersonalTransaction]

    def run(self) -> Outputs:
        logger = getattr(self._context, "logger", logging.getLogger(__name__))
        all_transactions = self.credit_card_transactions + self.bank_transactions
        for transaction in all_transactions:
            if transaction.date.tzinfo is not None:
                transaction.date = transaction.date.replace(tzinfo=None)

        sorted_transactions = sorted(all_transactions, key=lambda x: x.date, reverse=True)
        rules = get_all_transaction_rules()
        for transaction in sorted_transactions:
            has_matched = False
            for rule in rules:
                if rule.matches(transaction):
                    transaction.category = rule.category
                    if rule.description:
                        transaction.description = rule.description
                    has_matched = True
                    break

            if has_matched:
                continue

            response = self._context.vellum_client.ad_hoc.adhoc_execute_prompt_stream(
                ml_model="gpt-4o-mini",
                blocks=[
                    ChatMessagePromptBlock(
                        chat_role="SYSTEM",
                        blocks=[
                            RichTextPromptBlock(
                                blocks=[
                                    PlainTextPromptBlock(
                                        text="Classify the following transaction description into a category."
                                    )
                                ]
                            )
                        ],
                    ),
                    ChatMessagePromptBlock(
                        chat_role="USER",
                        blocks=[
                            RichTextPromptBlock(
                                blocks=[PlainTextPromptBlock(text=transaction.description)],
                            )
                        ],
                    ),
                ],
                input_values=[],
                input_variables=[],
                parameters=PromptParameters(
                    max_tokens=1000,
                    custom_parameters={
                        "json_schema": {
                            "name": "transaction_category",
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "category": {
                                        "type": "string",
                                        "enum": list(PERSONAL_TRANSACTION_CATEGORIES),
                                    },
                                },
                            },
                        },
                    },
                ),
            )
            for prompt_event in response:
                if not prompt_event.state == "FULFILLED":
                    continue

                output = prompt_event.outputs[0]
                if not output:
                    raise ValueError("No output from prompt")

                if output.type != "STRING" or not output.value:
                    raise ValueError("Output from prompt is not a string")

                category = json.loads(output.value).get("category")
                if category not in PERSONAL_TRANSACTION_CATEGORIES:
                    logger.error(f"Invalid category: {category}")
                    break

                add_transaction_rule(
                    description=transaction.description,
                    category=category,
                )
                transaction.category = category
                break

        return self.Outputs(transactions=sorted_transactions)


class UpdateFinances(BaseNode):
    credit_card_snapshot = GetCreditCardTransactions.Outputs.snapshot
    bank_snapshot = GetBankTransactions.Outputs.snapshot
    normalized_transactions = NormalizePersonalTransactions.Outputs.transactions

    class Outputs(BaseNode.Outputs):
        transactions_added: int

    def run(self) -> Outputs:
        date = datetime.now().strftime("%m/%d/%Y")
        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            sheet_name="Snapshots",
            rows=[
                [date, "Mercury Checking", self.bank_snapshot],
                [date, "Venmo Credit", self.credit_card_snapshot],
            ],
        )

        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            sheet_name="Transactions",
            rows=[
                [t.date.strftime("%m/%d/%Y"), t.source, t.description, t.amount, t.category, t.notes]
                for t in self.normalized_transactions
            ],
        )

        return self.Outputs(transactions_added=len(self.normalized_transactions))


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
        logger = getattr(self._context, "logger", logging.getLogger(__name__))

        try:
            to_email = USER.email
            date = datetime.now().strftime("%m/%d/%Y")
            send_email(
                to=to_email,
                body=self.message,
                subject=f"Financial Summary for {date}",
            )
            return self.Outputs(summary=f"Sent financial summary to {to_email}")
        except Exception:
            logger.exception("Failed to send email")

        return self.Outputs(summary=self.message)


class GetCapitalOneTransactions(BaseNode):
    class Outputs(BaseNode.Outputs):
        transactions: List[PersonalTransaction]
        snapshot: float

    def run(self) -> Outputs:
        capital_one_api_key = os.getenv("CAPITAL_ONE_API_KEY")
        if not capital_one_api_key:
            raise ValueError("CAPITAL_ONE_API_KEY environment variable not set")

        headers = {"Content-Type": "application/json"}
        base_url = "http://api.nessieisreal.com"
        
        accounts_url = f"{base_url}/accounts?key={capital_one_api_key}"
        accounts_response = requests.get(accounts_url, headers=headers)
        accounts_response.raise_for_status()
        accounts = accounts_response.json()
        
        if not accounts:
            return self.Outputs(transactions=[], snapshot=0.0)
            
        checking_account = accounts[0]
        account_id = checking_account["_id"]
        account_balance = checking_account["balance"]

        today_date = datetime.now()
        last_week_date = today_date - timedelta(days=7)
        
        all_transactions = []
        
        for transaction_type in ["purchases", "transfers", "withdrawals"]:
            transactions_url = f"{base_url}/accounts/{account_id}/{transaction_type}?key={capital_one_api_key}"
            transactions_response = requests.get(transactions_url, headers=headers)
            transactions_response.raise_for_status()
            transactions_data = transactions_response.json()
            
            for transaction in transactions_data:
                transaction_date = datetime.fromisoformat(transaction["transaction_date"])
                if last_week_date <= transaction_date <= today_date:
                    amount = transaction.get("amount", 0)
                    if transaction_type in ["purchases", "withdrawals"]:
                        amount = -abs(amount)
                    
                    all_transactions.append(
                        PersonalTransaction(
                            date=transaction_date,
                            source="Capital One Checking",
                            description=transaction.get("description", f"Capital One {transaction_type[:-1]}"),
                            amount=amount,
                            category="Uncategorized",
                            notes="PENDING" if transaction.get("status") == "pending" else "",
                        )
                    )

        return self.Outputs(
            transactions=all_transactions,
            snapshot=account_balance,
        )


class NormalizeFamilyTransactions(BaseNode):
    capital_one_transactions = GetCapitalOneTransactions.Outputs.transactions

    class Outputs(BaseNode.Outputs):
        transactions: list[PersonalTransaction]

    def run(self) -> Outputs:
        logger = getattr(self._context, "logger", logging.getLogger(__name__))
        
        for transaction in self.capital_one_transactions:
            if transaction.date.tzinfo is not None:
                transaction.date = transaction.date.replace(tzinfo=None)

        sorted_transactions = sorted(self.capital_one_transactions, key=lambda x: x.date, reverse=True)
        rules = get_all_transaction_rules()
        
        for transaction in sorted_transactions:
            has_matched = False
            for rule in rules:
                if rule.matches(transaction):
                    transaction.category = rule.category
                    if rule.description:
                        transaction.description = rule.description
                    has_matched = True
                    break

            if has_matched:
                continue

            response = self._context.vellum_client.ad_hoc.adhoc_execute_prompt_stream(
                ml_model="gpt-4o-mini",
                blocks=[
                    ChatMessagePromptBlock(
                        chat_role="SYSTEM",
                        blocks=[
                            RichTextPromptBlock(
                                blocks=[
                                    PlainTextPromptBlock(
                                        text="Classify the following transaction description into a category."
                                    )
                                ]
                            )
                        ],
                    ),
                    ChatMessagePromptBlock(
                        chat_role="USER",
                        blocks=[
                            RichTextPromptBlock(
                                blocks=[PlainTextPromptBlock(text=transaction.description)],
                            )
                        ],
                    ),
                ],
                input_values=[],
                input_variables=[],
                parameters=PromptParameters(
                    max_tokens=1000,
                    custom_parameters={
                        "json_schema": {
                            "name": "transaction_category",
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "category": {
                                        "type": "string",
                                        "enum": list(PERSONAL_TRANSACTION_CATEGORIES),
                                    },
                                },
                            },
                        },
                    },
                ),
            )
            for prompt_event in response:
                if not prompt_event.state == "FULFILLED":
                    continue

                output = prompt_event.outputs[0]
                if not output:
                    raise ValueError("No output from prompt")

                if output.type != "STRING" or not output.value:
                    raise ValueError("Output from prompt is not a string")

                category = json.loads(output.value).get("category")
                if category not in PERSONAL_TRANSACTION_CATEGORIES:
                    logger.error(f"Invalid category: {category}")
                    break

                add_transaction_rule(
                    description=transaction.description,
                    category=category,
                )
                transaction.category = category
                break

        return self.Outputs(transactions=sorted_transactions)


class WeeklyAccountingWorkflow(BaseWorkflow):
    graph = {
        BuildPersonalFinancialContext
        >> {
            GetVenmoScreenshots >> ParseVenmoScreenshots >> GetCreditCardTransactions,
            GetBankTransactions,
        }
        >> NormalizePersonalTransactions
        >> UpdateFinances
        >> GetSummaryData
        >> SummarizeData
        >> SendFinancesReport,
        GetCapitalOneTransactions >> NormalizeFamilyTransactions,
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = SendFinancesReport.Outputs.summary
