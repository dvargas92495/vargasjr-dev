import logging
from typing import Optional
from uuid import UUID, uuid4
import psycopg
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from services import postgres_session
from vellum.workflows.nodes import BaseNode
from sqlmodel import select
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from models.inbox_message import InboxMessage
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType, InboxType
from models.inbox import Inbox
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference

logger = logging.getLogger(__name__)


class SlimMessage(UniversalBaseModel):
    message_id: UUID
    body: str
    source: str
    channel: InboxType
    inbox_name: str
    inbox_id: UUID
    thread_id: Optional[str] = None


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
                    select(InboxMessage, Inbox.type, Inbox.name)
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
                            inbox_name="",
                            inbox_id=uuid4(),
                            thread_id=None,
                        )
                    )

                inbox_message, inbox_type, inbox_name = result
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=inbox_message.id,
                        operation=InboxMessageOperationType.READ,
                    )
                )
                session.commit()
                contact_source = "Unknown"
                if hasattr(inbox_message, 'contact') and inbox_message.contact:
                    contact = inbox_message.contact
                    contact_source = contact.slack_display_name or contact.full_name or contact.email or "Unknown"
                
                message = SlimMessage(
                    message_id=inbox_message.id,
                    body=inbox_message.body,
                    source=contact_source,
                    channel=inbox_type,
                    inbox_name=inbox_name,
                    inbox_id=inbox_message.inbox_id,
                    thread_id=inbox_message.thread_id,
                )
        except (psycopg.OperationalError, SQLAlchemyOperationalError):
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                    source="",
                    channel=InboxType.NONE,
                    inbox_name="",
                    inbox_id=uuid4(),
                    thread_id=None,
                )
            )

        return self.Outputs(message=message)
