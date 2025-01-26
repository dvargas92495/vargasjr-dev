from datetime import datetime
from functools import lru_cache
from logging import Logger
import logging
from pathlib import Path
from typing import Optional
import requests
from src.models.contact import Contact
from src.models.inbox import Inbox
import boto3

import os
from sqlalchemy import create_engine
from sqlmodel import Session, select, func
from src.models.inbox_message import InboxMessage
from src.models.pkm.sport_game import SportGame
from src.models.pkm.sport_team import SportTeam
from src.models.pkm.transaction_rule import TransactionRule
from src.models.types import InboxType, PersonalTransactionCategory, Sport


MEMORY_DIR = Path(__file__).parent.parent.parent.parent / ".memory"


def to_dollar_float(value: str) -> float:
    return float(value.replace("$", "").replace(",", ""))


def postgres_session(expire_on_commit: bool = True):
    """Get a SQLModel Session using the POSTGRES_URL environment variable"""
    url = os.getenv("POSTGRES_URL")
    if not url:
        raise ValueError("POSTGRES_URL is not set")

    engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
    return Session(engine, expire_on_commit=expire_on_commit)


def sqlite_session():
    engine = create_engine(f"sqlite:///{MEMORY_DIR}/pkm.db")
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


def create_contact(channel: InboxType, source: str) -> Contact:
    with postgres_session(expire_on_commit=False) as session:
        if channel == InboxType.EMAIL or channel == InboxType.FORM:
            contact = Contact(email=source)
        elif channel == InboxType.TEXT:
            contact = Contact(phone_number=source)
        else:
            raise ValueError(f"Unknown channel {channel}")

        session.add(contact)
        session.commit()
        return contact


def get_contact_by_email(email: str) -> Optional[Contact]:
    with postgres_session() as session:
        statement = select(Contact).where(Contact.email == email)
        return session.exec(statement).one_or_none()


def get_contact_by_phone_number(phone_number: str) -> Optional[Contact]:
    with postgres_session() as session:
        statement = select(Contact).where(Contact.phone_number == phone_number)
        return session.exec(statement).one_or_none()


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


def fetch_scoreboard_on_date(date: datetime, logger: Logger) -> list[SportGame]:
    logger.info(f"Fetching games for {date}")
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
                    logger.info(f"Game {espn_event['name']} was postponed. Skipping...")
                    continue
                raise ValueError(f"Game {espn_event['name']} is not completed")

            try:
                home_team_id = get_sport_team_by_espn_id(sport, espn_home_team["id"]).id
            except Exception:
                logger.error(f"Error getting team {espn_home_team['team']['displayName']}. Skipping...")
                continue

            try:
                away_team_id = get_sport_team_by_espn_id(sport, espn_away_team["id"]).id
            except Exception:
                logger.error(f"Error getting team {espn_away_team['team']['displayName']}. Skipping...")
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

    logger.info(f"Recording {len(games)} games")
    with sqlite_session() as session:
        session.add_all(games)
        session.commit()

    return games


def backup_memory(logger: Logger):
    if not MEMORY_DIR.exists():
        logger.info("No memory directory found")
        return

    s3_client = boto3.client("s3")
    bucket_name = "vargas-jr-memory"

    # Walk through all files in MEMORY_DIR
    for root, dirs, files in os.walk(MEMORY_DIR):
        for file in files:
            local_path = os.path.join(root, file)
            # Create S3 key by getting relative path from MEMORY_DIR
            s3_key = os.path.relpath(local_path, start=MEMORY_DIR)

            logger.info(f"Uploading {local_path} to s3://{bucket_name}/{s3_key}")
            try:
                s3_client.upload_file(local_path, bucket_name, s3_key)
            except Exception as e:
                logger.exception(f"Failed to upload {local_path}: {str(e)}")


def create_console_logger(name: str = __name__) -> Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Create formatter
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    console_handler.setFormatter(formatter)

    # Add handler to logger
    logger.addHandler(console_handler)

    return logger


def get_all_transaction_rules() -> list[TransactionRule]:
    with sqlite_session() as session:
        statement = select(TransactionRule)
        return session.exec(statement).all()


def add_transaction_rule(description: str, category: PersonalTransactionCategory) -> None:
    with sqlite_session() as session:
        session.add(
            TransactionRule(
                category=category,
                operation="EQUALS",
                target=description,
            )
        )
        session.commit()
