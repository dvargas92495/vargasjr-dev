import json
import os
from typing import Any, Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from services import get_application_by_name


SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_spreadsheets() -> Any:
    google_app = get_application_by_name("Google")
    if not google_app:
        raise ValueError("Google application not found in database")
    
    if not google_app.client_secret:
        raise ValueError("Google application credentials not properly configured")

    google_credentials = Credentials.from_service_account_info(
        json.loads(google_app.client_secret),
        scopes=SCOPES,
    )
    service = build("sheets", "v4", credentials=google_credentials)
    return service.spreadsheets()


def prepend_rows(
    spreadsheet_id: str,
    sheet_name: str,
    rows: list[list[str | float | None]],
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
