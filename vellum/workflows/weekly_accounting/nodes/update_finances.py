from datetime import datetime
from services.google_sheets import prepend_rows
from vellum.workflows.nodes import BaseNode
from .get_capital_one_transactions import GetCapitalOneTransactions
from .normalize_family_transactions import NormalizeFamilyTransactions

SPREADSHEET_ID = "1azbspgulxIEW7YSMFgscFm7GEJkSQIS3S_6cq60E4hw"


class UpdateFinances(BaseNode):
    capital_one_snapshot = GetCapitalOneTransactions.Outputs.snapshot
    normalized_transactions = NormalizeFamilyTransactions.Outputs.transactions

    class Outputs(BaseNode.Outputs):
        transactions_added: int

    def run(self) -> Outputs:
        date = datetime.now().strftime("%m/%d/%Y")
        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            sheet_name="Snapshots",
            rows=[
                [date, "Capital One Checking", self.capital_one_snapshot],
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
