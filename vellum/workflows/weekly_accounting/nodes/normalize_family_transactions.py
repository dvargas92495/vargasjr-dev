import json
import logging
from models.types import PERSONAL_TRANSACTION_CATEGORIES, PersonalTransaction
from services import add_transaction_rule, get_all_transaction_rules
from vellum import ChatMessagePromptBlock, JinjaPromptBlock, PromptParameters
from vellum.workflows.nodes import BaseNode
from .get_plaid_transactions import GetPlaidTransactions


class NormalizeFamilyTransactions(BaseNode):
    plaid_transactions = GetPlaidTransactions.Outputs.transactions

    class Outputs(BaseNode.Outputs):
        transactions: list[PersonalTransaction]

    def run(self) -> Outputs:
        logger = getattr(self._context, "logger", logging.getLogger(__name__))
        
        for transaction in self.plaid_transactions:
            if transaction.date.tzinfo is not None:
                transaction.date = transaction.date.replace(tzinfo=None)

        sorted_transactions = sorted(self.plaid_transactions, key=lambda x: x.date, reverse=True)
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
                            JinjaPromptBlock(
                                template="Classify the following transaction description into a category."
                            )
                        ],
                    ),
                    ChatMessagePromptBlock(
                        chat_role="USER",
                        blocks=[
                            JinjaPromptBlock(
                                template=transaction.description
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
