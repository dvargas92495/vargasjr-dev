import json
import os
from typing import Any, Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build


SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_spreadsheets() -> Any:
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    if not creds_json:
        raise ValueError("GOOGLE_CREDENTIALS environment variable not set")

    google_credentials = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=SCOPES,
    )
    service = build("sheets", "v4", credentials=google_credentials)
    return service.spreadsheets()


def prepend_rows(
    spreadsheet_id: str,
    sheet_name: str,
    rows: list[list[str | float]],
    sheets: Optional[Any] = None,
) -> None:
    if sheets is None:
        sheets = get_spreadsheets()

    header_row_count = 1

    spreadsheet = sheets.get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = next(
        sheet["properties"]["sheetId"]
        for sheet in spreadsheet.get("sheets", [])
        if sheet["properties"]["title"] == sheet_name
    )

    sheets.batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [
                {
                    "insertRange": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": header_row_count,
                            "endRowIndex": header_row_count + len(rows),
                        },
                        "shiftDimension": "ROWS",
                    }
                }
            ]
        },
    ).execute()

    sheets.values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A{header_row_count + 1}",
        valueInputOption="USER_ENTERED",
        body={"values": rows},
    ).execute()
