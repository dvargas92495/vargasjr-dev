import os
from threading import Event
import time
from uuid import uuid4
import pytest
from pytest_postgresql import factories
from agent.models.inbox import Inbox
from agent.models.inbox_message import InboxMessage
from agent.runner import AgentRunner


def test_agent_runner__happy_path(mocker):
    # GIVEN a cancel signal and logger
    cancel_signal = Event()
    logger = mocker.Mock()

    # AND an agent runner
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
    assert logger.error.call_count == 0, logger.error.call_args_list
    assert logger.info.call_count >= 2, logger.info.call_args_list
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: No messages found")

    # AND the test should exit...


def test_agent_runer__triage_message(mocker, mock_sql_session):
    # GIVEN a cancel signal and logger
    cancel_signal = Event()
    logger = mocker.Mock()

    # AND an agent runner
    agent_runner = AgentRunner(cancel_signal=cancel_signal, logger=logger)

    # AND a message response in the database
    inbox_id = uuid4()
    inbox = Inbox(
        id=inbox_id,
        name="test",
        type="FORM",
    )
    inbox_message = InboxMessage(
        inbox_id=inbox.id,
        source="test@test.com",
        body="Test message",
    )
    mock_sql_session.add(inbox)
    mock_sql_session.add(inbox_message)
    mock_sql_session.commit()

    # WHEN running the agent runner
    agent_runner.run()

    # AND sleep for a bit
    time.sleep(0.02)

    # AND then cancel the runner
    cancel_signal.set()

    # THEN the logger should have been called twice
    assert logger.error.call_count == 0
    assert logger.info.call_count >= 2, logger.info.call_args_list
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: Test message")
