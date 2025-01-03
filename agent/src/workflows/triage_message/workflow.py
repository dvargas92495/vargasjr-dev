import os
from uuid import UUID, uuid4
import psycopg
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from src.models.inbox import Inbox
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
)
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, BaseInlinePromptNode
from sqlmodel import Session, select
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from src.models.inbox_message import InboxMessage
from src.models.inbox_message_operation import InboxMessageOperation
from src.models.types import InboxMessageOperationType
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference


class SlimMessage(UniversalBaseModel):
    message_id: UUID
    body: str
    source: str
    channel: str


class ReadMessageNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        message: SlimMessage

    def run(self) -> Outputs:
        url = os.getenv("POSTGRES_URL")
        if not url:
            raise ValueError("POSTGRES_URL is not set")

        engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
        try:
            with Session(engine) as session:
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
                            channel="",
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
                    channel=inbox_type.value,
                )
        except (psycopg.OperationalError, SQLAlchemyOperationalError):
            # I suppose the agent could spin down while the agent is running, so we need to cancel this case.
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                    source="",
                    channel="",
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
    Reply to the message by sending an email to the sender.
    """
    pass


def email_initiate(
    to: str,
    subject: str,
    body: str,
):
    """
    Initiate an email to the sender.
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


class TriageMessageNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="You are triaging the latest unread message from your inbox. It was from {{ source }} and was submitted via {{ channel }}. Pick the most relevant action.",
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
        "source": ReadMessageNode.Outputs.message["source"],
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

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> BaseNode.Outputs:
        return self.Outputs(summary=f"Sent email to {self.to}.")


class NoActionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary = "No action taken."


class EmailReplyNode(SendEmailNode):
    to = ReadMessageNode.Outputs.message["source"]
    subject = "RE: "
    body = ParseFunctionCallNode.Outputs.parameters["body"]


class EmailInitiateNode(SendEmailNode):
    to = ParseFunctionCallNode.Outputs.parameters["to"]
    subject = ParseFunctionCallNode.Outputs.parameters["subject"]
    body = ParseFunctionCallNode.Outputs.parameters["body"]


class TextReplyNode(BaseNode):
    phone_number = ParseFunctionCallNode.Outputs.parameters["phone_number"]
    message = ParseFunctionCallNode.Outputs.parameters["message"]

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> BaseNode.Outputs:
        return self.Outputs(summary=f"Sent text message to {self.phone_number}.")


class TriageMessageWorkflow(BaseWorkflow):
    graph = (
        ReadMessageNode
        >> TriageMessageNode
        >> {
            ParseFunctionCallNode.Ports.no_action >> NoActionNode,
            ParseFunctionCallNode.Ports.email_reply >> EmailReplyNode,
            ParseFunctionCallNode.Ports.email_initiate >> EmailInitiateNode,
            ParseFunctionCallNode.Ports.text_reply >> TextReplyNode,
        }
    )

    class Outputs(BaseWorkflow.Outputs):
        summary = (
            NoActionNode.Outputs.summary.coalesce(EmailReplyNode.Outputs.summary)
            .coalesce(EmailInitiateNode.Outputs.summary)
            .coalesce(TextReplyNode.Outputs.summary)
        )
