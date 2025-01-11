from functools import lru_cache
import json
from typing import Optional
from src.models.inbox import Inbox


import os
from sqlalchemy import create_engine
from sqlmodel import Session, select, func
from src.models.inbox_message import InboxMessage
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
    return team_name.replace(" St ", " State ")
