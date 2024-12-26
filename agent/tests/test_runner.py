import os
from threading import Event
import time
import pytest
from pytest_postgresql import factories
from agent.models.contact_form_response import ContactFormResponse
from agent.runner import AgentRunner
from sqlmodel import Session, create_engine, SQLModel

postgresql_my_proc = factories.postgresql_proc(
    dbname="test_db",
    port=None,
)
postgresql = factories.postgresql("postgresql_my_proc")


@pytest.fixture
def mock_engine_info(postgresql):
    # Create a new test database
    url = f"postgresql+psycopg://{postgresql.info.user}:{postgresql.info.password}@{postgresql.info.host}:{postgresql.info.port}/{postgresql.info.dbname}"
    engine = create_engine(url)
    SQLModel.metadata.create_all(engine)
    yield engine, url
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def mock_session_info(mock_engine_info):
    engine, url = mock_engine_info
    with Session(engine) as session:
        yield session, url


def test_agent_runner__happy_path(mocker, mock_session_info):
    # GIVEN a cancel signal and logger
    cancel_signal = Event()
    logger = mocker.Mock()
    _, url = mock_session_info

    # AND an agent runner
    os.environ["POSTGRES_URL"] = url
    agent_runner = AgentRunner(
        cancel_signal=cancel_signal,
        logger=logger,
    )

    # WHEN running the agent runner
    agent_runner.run()

    # AND sleep for a bit
    time.sleep(0.02)

    # AND then cancel the runner
    cancel_signal.set()

    # THEN the logger should have been called once
    logger.info.assert_called_once_with("Running...")

    # AND the test should exit...


def test_agent_runer__triage_message(mocker, mock_session_info):
    # GIVEN a cancel signal and logger
    cancel_signal = Event()
    logger = mocker.Mock()
    mock_session, url = mock_session_info

    # AND an agent runner
    os.environ["POSTGRES_URL"] = url
    agent_runner = AgentRunner(cancel_signal=cancel_signal, logger=logger)

    # AND a message response in the database
    contact_form_response = ContactFormResponse(
        form_id="123",
        email="test@test.com",
        message="Test message",
    )
    mock_session.add(contact_form_response)
    mock_session.commit()

    # WHEN running the agent runner
    agent_runner.run()

    # AND sleep for a bit
    time.sleep(0.02)

    # AND then cancel the runner
    cancel_signal.set()

    # THEN the logger should have been called twice
    assert logger.error.call_count == 0
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: Test message")
