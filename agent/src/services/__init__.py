from datetime import datetime
from functools import lru_cache
import json
from typing import Optional
import requests
from src.models.inbox import Inbox


import os
from sqlalchemy import create_engine
from sqlmodel import Session, select, func
from src.models.inbox_message import InboxMessage
from src.models.pkm.sport_game import SportGame
from src.models.pkm.sport_team import SportTeam
from src.models.types import Sport


def postgres_session():
    """Get a SQLModel Session using the POSTGRES_URL environment variable"""
    url = os.getenv("POSTGRES_URL")
    if not url:
        raise ValueError("POSTGRES_URL is not set")

    engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
    return Session(engine)


def sqlite_session():
    engine = create_engine("sqlite:///data/pkm.db")
    return Session(engine)


def create_inbox_message(
    inbox_name: str,
    source: str,
    body: str,
) -> None:
    with postgres_session() as session:
        statement = select(Inbox.id).where(Inbox.name == inbox_name)
        inbox_id = session.exec(statement).one()

        inbox_message = InboxMessage(
            inbox_id=inbox_id,
            source=source,
            body=body,
        )
        session.add(inbox_message)
        session.commit()


@lru_cache
def get_sport_team_by_espn_id(sport: Sport, espn_id: str) -> SportTeam:
    with sqlite_session() as session:
        statement = select(SportTeam).where(SportTeam.sport == sport, SportTeam.espn_id == espn_id)
        return session.exec(statement).one()


@lru_cache
def get_sport_team_by_full_name(sport: Sport, full_name: str) -> SportTeam:
    with sqlite_session() as session:
        statement = select(SportTeam).where(
            SportTeam.sport == sport,
            func.printf("%s %s", SportTeam.location, SportTeam.name) == normalize_team_name(full_name),
        )
        return session.exec(statement).one()


def list_sport_teams(sport: Optional[Sport] = None) -> list[SportTeam]:
    with sqlite_session() as session:
        statement = select(SportTeam)
        if sport:
            statement = statement.where(SportTeam.sport == sport)
        return session.exec(statement).all()


def normalize_team_name(team_name: str) -> str:
    return team_name.replace(" St ", " State ").replace("LA Clippers", "Los Angeles Clippers")


def fetch_scoreboard_on_date(date: datetime) -> list[SportGame]:
    print(f"Fetching games for {date}")
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

    print(f"Recording {len(games)} games")
    with sqlite_session() as session:
        session.add_all(games)
        session.commit()

    return games
