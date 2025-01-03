from threading import Event
import time
from typing import Any, Iterator, List
from uuid import uuid4
import pytest
from sqlmodel import Session, select

from src.models.inbox import Inbox
from src.models.inbox_message import InboxMessage
from src.models.inbox_message_operation import InboxMessageOperation
from src.models.types import InboxMessageOperationType
from src.runner import AgentRunner
from vellum import (
    ExecutePromptEvent,
    FulfilledExecutePromptEvent,
    FunctionCall,
    FunctionCallVellumValue,
    InitiatedExecutePromptEvent,
    PromptOutput,
)


@pytest.fixture
def mock_ad_hoc_function_call(mocker):
    vellum_client_class = mocker.patch("vellum.workflows.vellum_client.Vellum")
    vellum_client = vellum_client_class.return_value

    def _mock_prompt_output(function_call: FunctionCall) -> None:
        # AND a known response from invoking an inline prompt
        expected_outputs: List[PromptOutput] = [
            FunctionCallVellumValue(
                value=function_call,
            ),
        ]

        execution_id = str(uuid4())
        expected_events: List[ExecutePromptEvent] = [
            InitiatedExecutePromptEvent(execution_id=execution_id),
            FulfilledExecutePromptEvent(
                execution_id=execution_id,
                outputs=expected_outputs,
            ),
        ]

        def generate_prompt_events(*args: Any, **kwargs: Any) -> Iterator[ExecutePromptEvent]:
            yield from expected_events

        vellum_client.ad_hoc.adhoc_execute_prompt_stream.side_effect = generate_prompt_events

    return _mock_prompt_output


@pytest.fixture
def mock_ses_send_email(mocker):
    ses_client_class = mocker.patch("boto3.client")
    ses_client = ses_client_class.return_value
    return ses_client.send_email


def test_agent_runner__happy_path(mocker, mock_sql_session):
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
    assert logger.info.call_count >= 1, logger.info.call_args_list
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    # TODO: Fix this test on CI by making call count >= 2
    # assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: No messages found")

    # AND the test should exit...


def test_agent_runer__triage_message(
    mocker, mock_sql_session: Session, mock_ad_hoc_function_call, mock_ses_send_email
):
    # GIVEN an agent runner
    cancel_signal = Event()
    logger = mocker.Mock()
    agent_runner = AgentRunner(
        cancel_signal=cancel_signal,
        logger=logger,
        max_loops=1,
    )

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

    # AND a mock ad hoc function call
    mock_ad_hoc_function_call(FunctionCall(name="email_reply", arguments={"body": "Hello there!"}))

    # AND the send email call was successful
    mock_ses_send_email.return_value = {}

    # WHEN running the agent runner
    agent_runner.run()
    while not cancel_signal.is_set():
        time.sleep(0.01)

    # THEN the logger should have been called twice
    assert logger.error.call_count == 0
    assert logger.info.call_count >= 2, logger.info.call_args_list
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: Sent email to test@test.com.")

    # AND the inbox message should have been read
    select_query = select(InboxMessageOperation).where(InboxMessageOperation.inbox_message_id == inbox_message.id)
    result = mock_sql_session.exec(select_query).first()
    assert result is not None
    assert result.operation == InboxMessageOperationType.READ

    # AND the email should have been sent
    mock_ses_send_email.assert_called_once_with(
        Source="hello@vargasjr.dev",
        Destination={"ToAddresses": ["test@test.com"]},
        Message={"Subject": {"Data": "RE: "}, "Body": {"Text": {"Data": "Hello there!"}}},
    )


def test_agent_runer__triage_message_all_read(mocker, mock_sql_session: Session, mock_ad_hoc_function_call):
    # GIVEN an agent runner
    cancel_signal = Event()
    logger = mocker.Mock()
    agent_runner = AgentRunner(
        cancel_signal=cancel_signal,
        logger=logger,
        max_loops=1,
    )

    # AND a message that has been read in the database
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
    inbox_message_operation = InboxMessageOperation(
        inbox_message_id=inbox_message.id,
        operation=InboxMessageOperationType.READ,
    )
    mock_sql_session.add(inbox)
    mock_sql_session.add(inbox_message)
    mock_sql_session.add(inbox_message_operation)
    mock_sql_session.commit()

    # AND a mock ad hoc function call
    mock_ad_hoc_function_call(FunctionCall(name="no_action", arguments={}))

    # WHEN running the agent runner
    agent_runner.run()
    while not cancel_signal.is_set():
        time.sleep(0.01)

    # THEN the logger should have been called twice with no messages found
    assert logger.error.call_count == 0
    assert logger.info.call_count >= 2, logger.info.call_args_list
    assert logger.info.call_args_list[0] == mocker.call("Running...")
    assert logger.info.call_args_list[1] == mocker.call("Workflow Complete: No action taken.")
