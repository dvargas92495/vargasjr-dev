import os
from datetime import datetime, timedelta
from typing import List
import requests
from models.types import PersonalTransaction
from vellum.workflows.nodes import BaseNode


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
