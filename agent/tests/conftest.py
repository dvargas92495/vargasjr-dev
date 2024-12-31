import logging
import os
import pytest
from pytest_postgresql import factories
from sqlmodel import SQLModel, Session, create_engine
from pathlib import Path
import glob

logger = logging.getLogger(__name__)

postgresql_agent_proc = factories.postgresql_proc(
    port=None,
    dbname="test_db",
)

migrations_dir = Path("../db/migrations")
migration_files = [Path(f) for f in sorted(glob.glob(str(migrations_dir / "*.sql")))]
postgresql = factories.postgresql(
    "postgresql_agent_proc",
    load=migration_files,  # type: ignore[arg-type]
)


@pytest.fixture(scope="function")
def mock_sql_engine(postgresql):
    """Create engine"""
    # Create SQLAlchemy engine
    url = f"postgresql+psycopg://{postgresql.info.user}:{postgresql.info.password}@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    engine = create_engine(url)

    old_url = os.getenv("POSTGRES_URL")
    os.environ["POSTGRES_URL"] = url

    yield engine

    if old_url:
        os.environ["POSTGRES_URL"] = old_url
    else:
        del os.environ["POSTGRES_URL"]

    # Cleanup after all tests
    # SQLModel.metadata.drop_all(engine)


@pytest.fixture(scope="function", autouse=True)
def mock_sql_session(mock_sql_engine):
    """Create a new session for each test."""
    with Session(mock_sql_engine) as session:
        yield session
        # Rollback any changes made in the test
        session.rollback()
