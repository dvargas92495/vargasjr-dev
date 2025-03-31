from uuid import uuid4
from sqlmodel import Session, select
from src.models.contact import Contact
from src.models.inbox import Inbox
from src.models.inbox_message import InboxMessage
from src.models.outbox_message import OutboxMessage
from src.models.types import InboxType
from src.workflows.triage_message.workflow import TriageMessageWorkflow
import requests_mock


def test_triage_message_workflow(
    mock_sql_session: Session,
    requests_mock: requests_mock.Mocker,
):
    # GIVEN the triage message workflow
    workflow = TriageMessageWorkflow()

    # AND a message from Slack about a reported bug
    message = "You need to change the Vargas jr produced videos dimensions, they're still coming out vertical"
    inbox_id = uuid4()
    inbox = Inbox(
        id=inbox_id,
        name="client-x-company",
        type=InboxType.SLACK,
    )
    inbox_message = InboxMessage(
        inbox_id=inbox.id,
        source="poc@company.com",
        body=message,
    )
    contact = Contact(
        email="poc@company.com",
    )
    mock_sql_session.add(inbox)
    mock_sql_session.add(inbox_message)
    mock_sql_session.add(contact)
    mock_sql_session.commit()

    # AND the Slack API returns a 200 response
    mocked_request = requests_mock.post(
        "https://slack.com/api/chat.postMessage",
        json={"ok": True},
    )

    # WHEN it is run
    final_event = workflow.run()

    # THEN the outputs are as expected
    assert final_event.name == "workflow.execution.fulfilled", final_event.model_dump_json()
    assert (
        final_event.outputs["summary"]
        == """\
Sent Slack reply to poc@company.com at #client-x-company.\
"""
        #         == """\
        # Sent Slack reply to poc@company.com. \
        # I also created an issue in my PKM to track the bug.\
        # """
    ), final_event.span_id

    # AND the Slack Response should have been sent
    assert mocked_request.call_count == 1
    assert mocked_request.last_request
    last_json = mocked_request.last_request.json()
    assert last_json["channel"] == "#client-x-company"
    assert last_json["text"].startswith("<@poc@company.com>")

    # AND that response is stored as an outbox message
    select_query = select(OutboxMessage).where(OutboxMessage.parent_inbox_message_id == inbox_message.id)
    outbox_message = mock_sql_session.exec(select_query).first()
    assert outbox_message

    # AND the PKM issue should have been created
    # TODO: flesh out issue creation
