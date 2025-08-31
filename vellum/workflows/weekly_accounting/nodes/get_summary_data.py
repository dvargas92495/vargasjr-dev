from datetime import datetime
from services import to_dollar_float
from services.google_sheets import get_spreadsheets
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from vellum.workflows.nodes import BaseNode
from .update_finances import UpdateFinances

SPREADSHEET_ID = "1azbspgulxIEW7YSMFgscFm7GEJkSQIS3S_6cq60E4hw"


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
