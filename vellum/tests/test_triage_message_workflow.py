from unittest.mock import patch
from uuid import uuid4

import pytest
from vellum.client.types import FunctionCallVellumValue, FunctionCall

from models.inbox import Inbox
from models.contact import Contact
from models.inbox_message import InboxMessage
from models.types import InboxType
from vellum.client.types import StringVellumValue

from services import postgres_session
from workflows.triage_message.workflow import TriageMessageWorkflow
from workflows.triage_message.nodes import ReadMessageNode, TriageMessageNode
from workflows.triage_message.nodes.read_message_node import SlimMessage
from workflows.triage_message.nodes.fetch_contact_summary_node import FetchContactSummaryNode
from workflows.triage_message.nodes.update_contact_summary_node import UpdateContactSummaryNode
from workflows.triage_message.nodes.upload_contact_summary_node import UploadContactSummaryNode


@pytest.fixture
def test_inbox():
    """Create a test inbox."""
    return Inbox(
        id=uuid4(),
        name="twilio-phone-+15559876543",
        type=InboxType.SMS,
        display_label="Test SMS Inbox",
        config={},
    )


@pytest.fixture
def test_contact():
    """Create a test contact."""
    return Contact(
        id=uuid4(),
        phone_number="+15551234567",
        full_name="Test Contact",
    )


@pytest.fixture
def test_inbox_message(test_inbox, test_contact):
    """Create a test inbox message."""
    return InboxMessage(
        id=uuid4(),
        inbox_id=test_inbox.id,
        contact_id=test_contact.id,
        body="Hello, who are you?",
        thread_id=None,
        external_id=None,
    )


@pytest.fixture
def test_slim_message(test_inbox, test_contact, test_inbox_message):
    """Create a test SlimMessage."""
    return SlimMessage(
        message_id=test_inbox_message.id,
        body=test_inbox_message.body,
        contact_email=test_contact.email,
        contact_id=test_contact.id,
        contact_full_name=test_contact.full_name,
        contact_slack_display_name=test_contact.slack_display_name,
        contact_phone_number=test_contact.phone_number,
        contact_status=test_contact.status,
        channel=test_inbox.type,
        inbox_name=test_inbox.name,
        inbox_id=test_inbox.id,
        thread_id=test_inbox_message.thread_id,
    )


def create_text_reply_function_call_output(phone_number: str, message: str):
    """Create a FunctionCallVellumValue for a text_reply function call."""
    function_call = FunctionCall(
        name="text_reply",
        arguments={"phone_number": phone_number, "message": message},
        id="test-function-call-id",
    )

    return FunctionCallVellumValue(
        type="FUNCTION_CALL",
        value=function_call,
    )


@patch("workflows.triage_message.nodes.text_reply_node.send_sms")
def test_triage_message_workflow_text_reply(
    mock_send_sms,
    test_inbox,
    test_contact,
    test_inbox_message,
    test_slim_message,
):
    """
    Test that the TriageMessage workflow correctly processes a text_reply function call
    and calls the Twilio API to send an SMS.
    """
    # Seed the database with test data so that TextReplyNode and StoreOutboxMessageNode
    # can interact with real database records
    with postgres_session() as session:
        session.add(test_inbox)
        session.add(test_contact)
        session.add(test_inbox_message)
        session.commit()

    test_phone_number = "+15551234567"
    test_message = "Hello! I am Vargas JR, an AI assistant."

    read_message_outputs = ReadMessageNode.Outputs(
        message=test_slim_message,
        job=None,
    )

    triage_message_outputs = TriageMessageNode.Outputs(
        results=[create_text_reply_function_call_output(test_phone_number, test_message)],
    )

    fetch_contact_summary_outputs = FetchContactSummaryNode.Outputs(
        current_summary=None,
        contact_id=str(test_slim_message.contact_id),
    )

    update_contact_summary_outputs = UpdateContactSummaryNode.Outputs(
        results=[StringVellumValue(type="STRING", value="Test contact summary")],
    )

    upload_contact_summary_outputs = UploadContactSummaryNode.Outputs(
        success=True,
    )

    workflow = TriageMessageWorkflow()
    result = workflow.run(
        node_output_mocks=[
            read_message_outputs,
            triage_message_outputs,
            fetch_contact_summary_outputs,
            update_contact_summary_outputs,
            upload_contact_summary_outputs,
        ],
    )

    mock_send_sms.assert_called_once_with(
        to=test_phone_number,
        from_="+15559876543",
        body=test_message,
    )

    if result.name != "workflow.execution.fulfilled":
        pytest.fail(f"Workflow rejected: {getattr(result, 'error', None)!r}")
