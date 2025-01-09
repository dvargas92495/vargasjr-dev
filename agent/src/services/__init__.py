import json
from src.models.inbox import Inbox


import os
from sqlalchemy import create_engine
from sqlmodel import Session, select
from src.models.inbox_message import InboxMessage
from src.models.types import Team


def postgres_session():
    """Get a SQLModel Session using the POSTGRES_URL environment variable"""
    url = os.getenv("POSTGRES_URL")
    if not url:
        raise ValueError("POSTGRES_URL is not set")

    engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
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


def get_teams() -> list[Team]:
    with open("data/teams.json", "r") as f:
        teams = json.load(f)
        return [Team.model_validate(team) for team in teams]
    
def normalize_team_name(team_name: str) -> str:
    return team_name.replace(" St ", " State ")
