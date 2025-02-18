import logging
from typing import Optional
from uuid import UUID, uuid4
import psycopg
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from src.models.contact import Contact
from src.models.inbox import Inbox
from src.models.outbox_message import OutboxMessage
from src.services import create_contact, get_contact_by_email, get_contact_by_phone_number, postgres_session
from src.services.aws import send_email
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, BaseInlinePromptNode
from sqlmodel import select
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from src.models.inbox_message import InboxMessage
from src.models.inbox_message_operation import InboxMessageOperation
from src.models.types import InboxMessageOperationType, InboxType
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference

logger = logging.getLogger(__name__)


class SlimMessage(UniversalBaseModel):
    message_id: UUID
    body: str
    source: str
    channel: InboxType


class ReadMessageNode(BaseNode):
    class Ports(BaseNode.Ports):
        no_action = Port.on_if(
            LazyReference(lambda: ReadMessageNode.Outputs.message["channel"].equals(InboxType.NONE))
        )
        triage = Port.on_else()

    class Outputs(BaseNode.Outputs):
        message: SlimMessage

    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                statement = (
                    select(InboxMessage, Inbox.type)
                    .join(
                        InboxMessageOperation, InboxMessageOperation.inbox_message_id == InboxMessage.id, isouter=True
                    )
                    .join(Inbox, Inbox.id == InboxMessage.inbox_id)
                    .where(InboxMessageOperation.operation.is_(None))
                    .order_by(InboxMessage.created_at.desc())
                )

                result = session.exec(statement).first()

                if not result:
                    return self.Outputs(
                        message=SlimMessage(
                            message_id=uuid4(),
                            body="No messages found",
                            source="",
                            channel=InboxType.NONE,
                        )
                    )

                inbox_message, inbox_type = result
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=inbox_message.id,
                        operation=InboxMessageOperationType.READ,
                    )
                )
                session.commit()
                message = SlimMessage(
                    message_id=inbox_message.id,
                    body=inbox_message.body,
                    source=inbox_message.source,
                    channel=inbox_type,
                )
        except (psycopg.OperationalError, SQLAlchemyOperationalError):
            # I suppose the agent could spin down while the agent is running, so we need to cancel this case.
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                    source="",
                    channel=InboxType.NONE,
                )
            )

        return self.Outputs(message=message)


def no_action():
    """
    There is no action to take. Skip this message.
    """
    pass


def email_reply(
    body: str,
):
    """
    Reply to the message by sending an email to the sender. Avoid a signature in the body
    of the email, as our template will add one for you.
    """
    pass


def email_initiate(
    to: str,
    subject: str,
    body: str,
):
    """
    Initiate an email to the sender. Form submissions should always prefer this action
    over email_reply, since there are no emails to reply to. Avoid a signature in the body
    of the email, as our template will add one for you.
    """
    pass


def text_reply(
    phone_number: str,
    message: str,
):
    """
    Reply to the message by sending a text message to the sender.
    """
    pass


class UpdateCRMNode(BaseNode):
    channel = ReadMessageNode.Outputs.message["channel"]
    source = ReadMessageNode.Outputs.message["source"]

    class Outputs(BaseNode.Outputs):
        contact: Contact

    def run(self) -> BaseNode.Outputs:
        contact: Optional[Contact] = None
        if self.channel == InboxType.EMAIL or self.channel == InboxType.FORM:
            contact = get_contact_by_email(self.source)
        elif self.channel == InboxType.SMS:
            contact = get_contact_by_phone_number(self.source)
        else:
            raise ValueError(f"Unknown channel {self.channel}")

        if not contact:
            contact = create_contact(self.channel, self.source)

        return self.Outputs(contact=contact)


class TriageMessageNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are triaging the latest unread message from your inbox. It was from \
{{ contact }} and was submitted via {{ channel }}. Pick the most relevant action.""",
                ),
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=[
                JinjaPromptBlock(
                    template="""\
{{ message }}
""",
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "contact": UpdateCRMNode.Outputs.contact["identifier"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
    }
    functions = [
        no_action,
        email_reply,
        email_initiate,
        text_reply,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )


class ParseFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        no_action = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("no_action")))
        email_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_reply")))
        email_initiate = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_initiate"))
        )
        text_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("text_reply")))

    class Outputs(BaseNode.Outputs):
        action = TriageMessageNode.Outputs.results[0]["value"]["name"]
        parameters = TriageMessageNode.Outputs.results[0]["value"]["arguments"]


class SendEmailNode(BaseNode):
    to: str
    subject: str
    body: str
    inbox_message_id: UUID

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: OutboxMessage

    def run(self) -> BaseNode.Outputs:
        try:
            send_email(
                to=self.to,
                body=self.body,
                subject=self.subject,
            )
        except Exception:
            logger.exception("Failed to send email to %s", self.to)
            return self.Outputs(summary=f"Failed to send email to {self.to}.")

        return self.Outputs(
            summary=f"Sent email to {self.to}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=self.body,
                type=InboxType.EMAIL,
            ),
        )


class NoActionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary = "No action taken."


class EmailReplyNode(SendEmailNode):
    to = ReadMessageNode.Outputs.message["source"]
    subject = "RE: "
    body = ParseFunctionCallNode.Outputs.parameters["body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]


class EmailInitiateNode(SendEmailNode):
    to = ParseFunctionCallNode.Outputs.parameters["to"]
    subject = ParseFunctionCallNode.Outputs.parameters["subject"]
    body = ParseFunctionCallNode.Outputs.parameters["body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]


class TextReplyNode(BaseNode):
    phone_number = ParseFunctionCallNode.Outputs.parameters["phone_number"]
    message = ParseFunctionCallNode.Outputs.parameters["message"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: OutboxMessage

    def run(self) -> BaseNode.Outputs:
        return self.Outputs(
            summary=f"Sent text message to {self.phone_number}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=self.message,
                type=InboxType.SMS,
            ),
        )


class StoreOutboxMessageNode(BaseNode):
    summary = EmailReplyNode.Outputs.summary.coalesce(EmailInitiateNode.Outputs.summary).coalesce(
        TextReplyNode.Outputs.summary
    )

    outbox_message = EmailReplyNode.Outputs.outbox_message.coalesce(EmailInitiateNode.Outputs.outbox_message).coalesce(
        TextReplyNode.Outputs.outbox_message
    )

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> BaseNode.Outputs:
        with postgres_session() as session:
            session.add(self.outbox_message)
            session.commit()
        return self.Outputs(summary=self.summary)


class TriageMessageWorkflow(BaseWorkflow):
    graph = {
        ReadMessageNode.Ports.no_action >> NoActionNode,
        ReadMessageNode.Ports.triage
        >> UpdateCRMNode
        >> TriageMessageNode
        >> {
            ParseFunctionCallNode.Ports.no_action >> NoActionNode,
            {
                ParseFunctionCallNode.Ports.email_reply >> EmailReplyNode,
                ParseFunctionCallNode.Ports.email_initiate >> EmailInitiateNode,
                ParseFunctionCallNode.Ports.text_reply >> TextReplyNode,
            }
            >> StoreOutboxMessageNode,
        },
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = NoActionNode.Outputs.summary.coalesce(StoreOutboxMessageNode.Outputs.summary)
