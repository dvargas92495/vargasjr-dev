from datetime import datetime, timedelta
from src.services import fetch_scoreboard_on_date


if __name__ == "__main__":
    today = datetime.now()
    for i in range(1):
        date = today - timedelta(days=i) - timedelta(days=2)
        games = fetch_scoreboard_on_date(date)
