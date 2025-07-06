from datetime import datetime
from functools import lru_cache
from logging import Logger
import logging
from pathlib import Path
from typing import Optional
import requests
from models.contact import Contact
from models.inbox import Inbox
from models.application import Application
import boto3

import os
from sqlalchemy import create_engine
from sqlmodel import Session, select, func
from models.inbox_message import InboxMessage
from models.pkm.sport_game import SportGame
from models.pkm.sport_team import SportTeam
from models.pkm.transaction_rule import TransactionRule
from models.types import InboxType, PersonalTransactionCategory, Sport


MEMORY_DIR = Path(__file__).parent.parent.parent.parent / ".memory"


def to_dollar_float(value: str) -> float:
    return float(value.replace("$", "").replace(",", ""))


def postgres_session(expire_on_commit: bool = True):
    """Get a SQLModel Session using the POSTGRES_URL environment variable"""
    url = os.getenv("POSTGRES_URL")
    if not url:
        raise ValueError("POSTGRES_URL is not set")

    def mask_url_password(url: str) -> str:
        """Mask password in database URL while preserving protocol and other details"""
        if "@" not in url:
            return f"No @ found in URL: {url}"
        
        try:
            protocol_and_auth = url.split("@")[0]  # protocol://user:password
            host_and_rest = url.split("@")[1]      # host:port/database?params
            
            if "://" not in protocol_and_auth:
                return f"No :// found in URL: {url}"
            
            protocol = protocol_and_auth.split("://")[0]  # protocol
            auth_part = protocol_and_auth.split("://")[1]  # user:password
            
            if ":" in auth_part:
                user = auth_part.split(":")[0]
                return f"{protocol}://{user}:***@{host_and_rest}"
            else:
                return f"{protocol}://{auth_part}:***@{host_and_rest}"
        except Exception:
            if "://" in url:
                protocol = url.split("://")[0]
                return f"{protocol}://***"
            return "***"

    try:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        
        engine = create_engine(url)
        return Session(engine, expire_on_commit=expire_on_commit)
    except Exception as e:
        masked_url_for_error = url
        if url.startswith("postgres://"):
            masked_url_for_error = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            masked_url_for_error = url.replace("postgresql://", "postgresql+psycopg://", 1)
        
        masked_url = mask_url_password(masked_url_for_error)
        url_prefix = url[:20] + "..." if len(url) > 20 else url
        raise Exception(f"Failed to create database session with URL: {masked_url} (original URL prefix: {url_prefix})") from e


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
        if channel == InboxType.EMAIL or channel == InboxType.FORM or channel == InboxType.SLACK:
            contact = Contact(email=source)
        elif channel == InboxType.SMS:
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
    return (
        team_name.replace("Mt. ", "Mount ")
        .replace(" St ", " State ")
        .replace("LA Clippers", "Los Angeles Clippers")
        .replace("American Eagles", "American University Eagles")
        .replace("SIU-Edwardsville", "SIU Edwardsville")
        .replace(" Lopes", " Antelopes")
    )


def normalize_espn_team_name(competitor: dict) -> str:
    return normalize_team_name(f"{competitor['team']['location']} {competitor['team']['name']}")


def fetch_scoreboard_on_date(date: datetime, logger: Logger) -> list[SportGame]:
    logger.info(f"Fetching games for {date}")
    sports: list[tuple[Sport, str, dict]] = [
        (Sport.MLB, "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", {}),
        (Sport.NBA, "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", {}),
        (
            Sport.NCAAB,
            "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
            {"groups": "50"},
        ),
        (Sport.NFL, "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", {}),
    ]
    games: list[SportGame] = []
    for sport, url, extra_params in sports:
        params = {
            "dates": date.strftime("%Y%m%d"),
            **extra_params,
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
                logger.error(f"No home or away team found for {espn_event['name']}")
                continue
            if not espn_competition["status"]["type"]["completed"]:
                if espn_competition["status"]["type"]["name"] == "STATUS_POSTPONED":
                    logger.info(f"Game {espn_event['name']} was postponed. Skipping...")
                    continue
                logger.error(f"Game {espn_event['name']} is not completed")
                continue

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
        try:
            for game in games:
                session.merge(game)
            session.commit()
        except Exception:
            logger.exception("Failed to commit games")

    return games


def backup_memory(logger: Logger):
    if not MEMORY_DIR.exists():
        logger.info("No memory directory found")
        return

    session = boto3.Session()
    s3_client = session.client("s3")
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

    del s3_client
    del session


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


def get_application_by_name(name: str) -> Optional[Application]:
    """Get application credentials by name from the database"""
    with postgres_session() as session:
        statement = select(Application).where(Application.name == name)
        return session.exec(statement).one_or_none()
