import logging
import os
import json
from datetime import datetime, timedelta
from typing import List
import requests
from vellum import (
    ChatMessagePromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
)
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from src.models.personal_transaction import PersonalTransaction
from src.services.transaction_rules import get_all_transaction_rules, add_transaction_rule
from src.constants.personal_transaction_categories import PERSONAL_TRANSACTION_CATEGORIES


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


class NormalizeCapitalOneTransactions(BaseNode):
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


class CapitalOneAccountingWorkflow(BaseWorkflow):
    graph = GetCapitalOneTransactions >> NormalizeCapitalOneTransactions

    class Outputs(BaseWorkflow.Outputs):
        transactions = NormalizeCapitalOneTransactions.Outputs.transactions
