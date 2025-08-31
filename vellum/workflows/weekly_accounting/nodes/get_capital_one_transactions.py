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

        token_url = "https://api-sandbox.capitalone.com/oauth2/token"
        token_data = {
            "client_id": capital_one_app.client_id,
            "client_secret": capital_one_app.client_secret,
            "grant_type": "client_credentials"
        }
        token_headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        token_response = requests.post(token_url, data=token_data, headers=token_headers)
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data["access_token"]
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        base_url = "https://api-sandbox.capitalone.com"
        
        accounts_url = f"{base_url}/bank/accounts"
        accounts_response = requests.get(accounts_url, headers=headers)
        accounts_response.raise_for_status()
        accounts_data = accounts_response.json()
        
        if not accounts_data.get("accounts"):
            return self.Outputs(transactions=[], snapshot=0.0)
            
        checking_account = accounts_data["accounts"][0]
        account_id = checking_account["accountId"]
        account_balance = checking_account["currentBalance"]

        today_date = datetime.now()
        last_week_date = today_date - timedelta(days=7)
        
        transactions_url = f"{base_url}/bank/accounts/{account_id}/transactions"
        transactions_params = {
            "fromDate": last_week_date.strftime("%Y-%m-%d"),
            "toDate": today_date.strftime("%Y-%m-%d")
        }
        transactions_response = requests.get(transactions_url, headers=headers, params=transactions_params)
        transactions_response.raise_for_status()
        transactions_data = transactions_response.json()
        
        all_transactions = []
        
        for transaction in transactions_data.get("transactions", []):
            transaction_date = datetime.fromisoformat(transaction["transactionDate"])
            amount = transaction.get("amount", 0)
            
            if transaction.get("creditDebitIndicator") == "DEBIT":
                amount = -abs(amount)
            
            all_transactions.append(
                PersonalTransaction(
                    date=transaction_date,
                    source="Capital One Checking",
                    description=transaction.get("description", "Capital One Transaction"),
                    amount=amount,
                    category="Uncategorized",
                    notes="PENDING" if transaction.get("status") == "PENDING" else "",
                )
            )

        return self.Outputs(
            transactions=all_transactions,
            snapshot=account_balance,
        )
