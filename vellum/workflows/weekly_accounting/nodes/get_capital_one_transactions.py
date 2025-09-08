import os
from datetime import datetime, timedelta
from typing import List
import requests
from models.types import PersonalTransaction
from vellum.workflows.nodes import BaseNode
from services import get_application_by_name


class GetCapitalOneTransactions(BaseNode):
    class Outputs(BaseNode.Outputs):
        transactions: List[PersonalTransaction]
        snapshot: float

    def run(self) -> Outputs:
        capital_one_app = get_application_by_name("Family Capital One Account")
        if not capital_one_app:
            raise ValueError("Family Capital One Account application not found in database")
        
        if not capital_one_app.client_id or not capital_one_app.client_secret:
            raise ValueError("Capital One client credentials not configured in database")

        headers = {
            "PLAID-CLIENT-ID": capital_one_app.client_id,
            "PLAID-SECRET": capital_one_app.client_secret,
            "Content-Type": "application/json"
        }
        base_url = "https://production.plaid.com"
        
        if not capital_one_app.access_token:
            raise ValueError("Plaid access token not configured. Please complete Plaid Link flow first.")
        
        accounts_payload = {
            "access_token": capital_one_app.access_token
        }
        accounts_response = requests.post(f"{base_url}/accounts/get", json=accounts_payload, headers=headers)
        accounts_response.raise_for_status()
        accounts_data = accounts_response.json()
        
        if not accounts_data.get("accounts"):
            return self.Outputs(transactions=[], snapshot=0.0)
            
        checking_account = None
        for account in accounts_data["accounts"]:
            if account.get("subtype") == "checking":
                checking_account = account
                break
        
        if not checking_account:
            checking_account = accounts_data["accounts"][0]
        
        account_balance = checking_account["balances"]["current"] or 0.0

        transactions_payload = {
            "access_token": capital_one_app.access_token,
            "cursor": None,
            "count": 500
        }
        
        transactions_response = requests.post(f"{base_url}/transactions/sync", json=transactions_payload, headers=headers)
        transactions_response.raise_for_status()
        transactions_data = transactions_response.json()
        
        all_transactions = []
        today_date = datetime.now()
        last_week_date = today_date - timedelta(days=7)
        
        for transaction in transactions_data.get("added", []):
            transaction_date = datetime.fromisoformat(transaction["date"])
            
            if transaction_date < last_week_date:
                continue
                
            amount = transaction.get("amount", 0)
            
            all_transactions.append(
                PersonalTransaction(
                    date=transaction_date,
                    source="Capital One Checking",
                    description=transaction.get("name", "Capital One Transaction"),
                    amount=amount,
                    category="Uncategorized",
                    notes="PENDING" if transaction.get("pending") else "",
                )
            )

        return self.Outputs(
            transactions=all_transactions,
            snapshot=account_balance,
        )
