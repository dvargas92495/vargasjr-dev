import logging
import os
import pytest
import shutil
import subprocess
import tempfile
from pytest_postgresql import factories
from sqlmodel import SQLModel, Session, create_engine
from pathlib import Path
import glob

logger = logging.getLogger(__name__)

def generate_temp_migrations():
    """Generate migrations to a temporary directory using drizzle-kit."""
    temp_dir = tempfile.mkdtemp()
    
    repo_root = Path(__file__).parent.parent.parent
    
    try:
        env = os.environ.copy()
        env["POSTGRES_URL"] = "postgresql://test:test@localhost:5432/test"
        
        result = subprocess.run(
            ["npx", "drizzle-kit", "generate", "--schema", "./db/schema.ts", "--dialect", "postgresql", "--out", temp_dir],
            cwd=repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"Generated migrations to {temp_dir}")
        
        migration_files = [Path(f) for f in sorted(glob.glob(str(Path(temp_dir) / "*.sql")))]
        return migration_files, temp_dir
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to generate migrations: {e.stderr}")
        raise

postgresql_agent_proc = factories.postgresql_proc(
    port=None,
    dbname="test_db",
)

migration_files, temp_migrations_dir = generate_temp_migrations()
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


def pytest_sessionfinish(session, exitstatus):
    """Clean up temporary migrations directory after all tests."""
    if 'temp_migrations_dir' in globals():
        shutil.rmtree(temp_migrations_dir, ignore_errors=True)
        logger.info(f"Cleaned up temporary migrations directory: {temp_migrations_dir}")
