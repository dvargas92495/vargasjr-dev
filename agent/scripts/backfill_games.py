from datetime import datetime, timedelta
import requests
from src.models.pkm.sport_game import SportGame
from src.models.types import Sport
from src.services import get_sport_team_by_espn_id, sqlite_session


def fetch_scoreboard_on_date(date: datetime) -> list[SportGame]:
    sports = [
        (Sport.MLB, "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"),
        (Sport.NBA, "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"),
        (Sport.NCAAB, "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"),
        (Sport.NFL, "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"),
    ]
    games: list[SportGame] = []
    for sport, url in sports:
        params = {
            "dates": date.strftime("%Y%m%d"),
        }
        response = requests.get(url, params=params)
        data = response.json()
        for espn_event in data["events"]:
            espn_competition = espn_event["competitions"][0]
            espn_home_team = next(
                (competitor for competitor in espn_competition["competitors"] if competitor["homeAway"] == "home"),
                None,
            )
            espn_away_team = next(
                (competitor for competitor in espn_competition["competitors"] if competitor["homeAway"] == "away"),
                None,
            )
            if not espn_home_team or not espn_away_team:
                raise ValueError(f"No home or away team found for {espn_event['name']}")
            if not espn_competition["status"]["type"]["completed"]:
                if espn_competition["status"]["type"]["name"] == "STATUS_POSTPONED":
                    print(f"Game {espn_event['name']} was postponed. Skipping...")
                    continue
                raise ValueError(f"Game {espn_event['name']} is not completed")

            try:
                home_team_id = get_sport_team_by_espn_id(sport, espn_home_team["id"]).id
            except Exception:
                print(f"Error getting team {espn_home_team['team']['displayName']}. Skipping...")
                continue

            try:
                away_team_id = get_sport_team_by_espn_id(sport, espn_away_team["id"]).id
            except Exception:
                print(f"Error getting team {espn_away_team['team']['displayName']}. Skipping...")
                continue

            games.append(
                SportGame(
                    home_team_id=home_team_id,
                    away_team_id=away_team_id,
                    home_team_score=espn_home_team["score"],
                    away_team_score=espn_away_team["score"],
                    start_time=datetime.fromisoformat(espn_competition["date"]),
                    end_time=datetime.fromisoformat(espn_competition["date"]),
                )
            )

    return games


if __name__ == "__main__":
    today = datetime.now()
    for i in range(16):
        date = today - timedelta(days=i) - timedelta(days=15)
        print(f"Fetching games for {date}")
        games = fetch_scoreboard_on_date(date)
        print(f"Recording {len(games)} games")
        with sqlite_session() as session:
            session.add_all(games)
            session.commit()
