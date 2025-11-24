import logging
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
import psycopg
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from services import postgres_session
from vellum.workflows.nodes import BaseNode
from sqlmodel import select, or_, func
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from models.inbox_message import InboxMessage
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType, InboxType, ContactStatus
from models.inbox import Inbox
from models.contact import Contact
from models.job import Job
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
    contact_phone_number: Optional[str] = None
    contact_status: Optional[ContactStatus] = None
    channel: InboxType
    inbox_name: str
    inbox_id: UUID
    thread_id: Optional[str] = None


class SlimJob(UniversalBaseModel):
    job_id: UUID
    name: str
    description: Optional[str] = None
    due_date: datetime
    priority: float
    contact_id: Optional[UUID] = None


class ReadMessageNode(BaseNode):
    class Ports(BaseNode.Ports):
        no_action = Port.on_if(
            LazyReference(lambda: ReadMessageNode.Outputs.message["channel"].equals(InboxType.NONE))
            & LazyReference(lambda: ReadMessageNode.Outputs.job["job_id"].equals(uuid4()))
        )
        process_job = Port.on_if(
            LazyReference(lambda: ReadMessageNode.Outputs.message["channel"].equals(InboxType.NONE))
            & ~LazyReference(lambda: ReadMessageNode.Outputs.job["job_id"].equals(uuid4()))
        )
        triage = Port.on_else()

    class Outputs(BaseNode.Outputs):
        message: SlimMessage
        job: SlimJob

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
                    select(InboxMessage, Inbox.type, Inbox.name, Contact)
                    .join(
                        latest_operations_subquery,
                        latest_operations_subquery.c.inbox_message_id == InboxMessage.id,
                        isouter=True
                    )
                    .join(Inbox, Inbox.id == InboxMessage.inbox_id)  # type: ignore
                    .join(Contact, Contact.id == InboxMessage.contact_id)  # type: ignore
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
                    # No messages found, check for jobs
                    job_statement = (
                        select(Job)
                        .order_by(Job.priority.desc(), Job.due_date.asc())  # type: ignore
                    )
                    job_result = session.exec(job_statement).first()
                    
                    if job_result:
                        # Found a job to process
                        return self.Outputs(
                            message=SlimMessage(
                                message_id=uuid4(),
                                body="No messages found",
                                contact_email=None,
                                contact_id=uuid4(),
                                contact_full_name=None,
                                contact_slack_display_name=None,
                                contact_phone_number=None,
                                contact_status=None,
                                channel=InboxType.NONE,
                                inbox_name="",
                                inbox_id=uuid4(),
                                thread_id=None,
                            ),
                            job=SlimJob(
                                job_id=job_result.id,
                                name=job_result.name,
                                description=job_result.description,
                                due_date=job_result.due_date,
                                priority=job_result.priority,
                                contact_id=job_result.contact_id,
                            )
                        )
                    else:
                        # No messages and no jobs
                        dummy_job_id = uuid4()
                        return self.Outputs(
                            message=SlimMessage(
                                message_id=uuid4(),
                                body="No messages found",
                                contact_email=None,
                                contact_id=uuid4(),
                                contact_full_name=None,
                                contact_slack_display_name=None,
                                contact_phone_number=None,
                                contact_status=None,
                                channel=InboxType.NONE,
                                inbox_name="",
                                inbox_id=uuid4(),
                                thread_id=None,
                            ),
                            job=SlimJob(
                                job_id=dummy_job_id,
                                name="",
                                description=None,
                                due_date=datetime.now(),
                                priority=0.0,
                                contact_id=None,
                            )
                        )

                inbox_message, inbox_type, inbox_name, contact = result
                
                execution_id = self.state.meta.span_id
                
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=inbox_message.id,
                        operation=InboxMessageOperationType.READ,
                        execution_id=execution_id,
                    )
                )
                session.commit()
                
                message = SlimMessage(
                    message_id=inbox_message.id,
                    body=inbox_message.body,
                    contact_email=contact.email,
                    contact_id=inbox_message.contact_id,
                    contact_full_name=contact.full_name,
                    contact_slack_display_name=contact.slack_display_name,
                    contact_phone_number=contact.phone_number,
                    contact_status=contact.status,
                    channel=inbox_type,
                    inbox_name=inbox_name,
                    inbox_id=inbox_message.inbox_id,
                    thread_id=inbox_message.thread_id,
                )
                
                # Return dummy job when we have a message
                dummy_job_id = uuid4()
                return self.Outputs(
                    message=message,
                    job=SlimJob(
                        job_id=dummy_job_id,
                        name="",
                        description=None,
                        due_date=datetime.now(),
                        priority=0.0,
                        contact_id=None,
                    )
                )
        except (psycopg.OperationalError, SQLAlchemyOperationalError):
            dummy_job_id = uuid4()
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                    contact_email=None,
                    contact_id=uuid4(),
                    contact_full_name=None,
                    contact_slack_display_name=None,
                    contact_phone_number=None,
                    contact_status=None,
                    channel=InboxType.NONE,
                    inbox_name="",
                    inbox_id=uuid4(),
                    thread_id=None,
                ),
                job=SlimJob(
                    job_id=dummy_job_id,
                    name="",
                    description=None,
                    due_date=datetime.now(),
                    priority=0.0,
                    contact_id=None,
                )
            )
