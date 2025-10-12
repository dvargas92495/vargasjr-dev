import logging
from typing import Optional
from uuid import UUID, uuid4
import psycopg
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from services import postgres_session
from vellum.workflows.nodes import BaseNode
from sqlmodel import select, or_, func
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
    contact_email: Optional[str] = None
    contact_id: UUID
    contact_full_name: Optional[str] = None
    contact_slack_display_name: Optional[str] = None
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
                ranked_operations = (
                    select(
                        InboxMessageOperation.inbox_message_id,
                        InboxMessageOperation.operation,
                        func.row_number()
                        .over(
                            partition_by=[InboxMessageOperation.inbox_message_id],  # type: ignore
                            order_by=InboxMessageOperation.created_at.desc()  # type: ignore
                        )
                        .label("rn"),
                    )
                    .subquery()
                )

                latest_operations_subquery = (
                    select(ranked_operations.c.inbox_message_id, ranked_operations.c.operation)
                    .where(ranked_operations.c.rn == 1)
                    .subquery()
                )

                statement = (
                    select(InboxMessage, Inbox.type, Inbox.name)
                    .join(
                        latest_operations_subquery,
                        latest_operations_subquery.c.inbox_message_id == InboxMessage.id,
                        isouter=True
                    )
                    .join(Inbox, Inbox.id == InboxMessage.inbox_id)  # type: ignore
                    .where(
                        or_(
                            latest_operations_subquery.c.operation.is_(None),
                            latest_operations_subquery.c.operation == InboxMessageOperationType.UNREAD
                        )
                    )
                    .order_by(InboxMessage.created_at.desc())  # type: ignore
                )

                result = session.exec(statement).first()

                if not result:
                    return self.Outputs(
                        message=SlimMessage(
                            message_id=uuid4(),
                            body="No messages found",
                            contact_email=None,
                            contact_id=uuid4(),
                            contact_full_name=None,
                            contact_slack_display_name=None,
                            channel=InboxType.NONE,
                            inbox_name="",
                            inbox_id=uuid4(),
                            thread_id=None,
                        )
                    )

                inbox_message, inbox_type, inbox_name = result
                
                execution_id = self.state.meta.span_id
                
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=inbox_message.id,
                        operation=InboxMessageOperationType.READ,
                        execution_id=execution_id,
                    )
                )
                session.commit()
                contact_email = None
                contact_full_name = None
                contact_slack_display_name = None
                contact_id = inbox_message.contact_id
                
                if hasattr(inbox_message, 'contact') and inbox_message.contact:
                    contact = inbox_message.contact
                    contact_email = contact.email
                    contact_full_name = contact.full_name
                    contact_slack_display_name = contact.slack_display_name
                
                message = SlimMessage(
                    message_id=inbox_message.id,
                    body=inbox_message.body,
                    contact_email=contact_email,
                    contact_id=contact_id,
                    contact_full_name=contact_full_name,
                    contact_slack_display_name=contact_slack_display_name,
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
                    contact_email=None,
                    contact_id=uuid4(),
                    contact_full_name=None,
                    contact_slack_display_name=None,
                    channel=InboxType.NONE,
                    inbox_name="",
                    inbox_id=uuid4(),
                    thread_id=None,
                )
            )

        return self.Outputs(message=message)
