import logging
from typing import Optional
from uuid import UUID
from models.outbox_message import OutboxMessage
from models.types import InboxType
from models.inbox_message import InboxMessage
from services import postgres_session
from services.aws import send_email, extract_original_message_id
from sqlmodel import select
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode

logger = logging.getLogger(__name__)


class JobOpportunityResponseNode(BaseNode):
    original_recruiter_email = ParseFunctionCallNode.Outputs.parameters["original_recruiter_email"]
    recruiter_subject = ParseFunctionCallNode.Outputs.parameters["recruiter_subject"]
    recruiter_body = ParseFunctionCallNode.Outputs.parameters["recruiter_body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
    forwarder_email = ReadMessageNode.Outputs.message["contact_email"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: Optional[OutboxMessage] = None

    def run(self) -> BaseNode.Outputs:
        from services import get_contact_id_by_email
        
        try:
            original_message_id = None
            with postgres_session() as session:
                statement = select(InboxMessage).where(InboxMessage.id == self.inbox_message_id)
                inbox_message = session.exec(statement).first()
                if inbox_message and inbox_message.external_id:
                    original_message_id = extract_original_message_id(inbox_message.external_id)
            
            send_email(
                to=self.original_recruiter_email,
                body=self.recruiter_body,
                subject=self.recruiter_subject,
                bcc=self.forwarder_email,
                in_reply_to=original_message_id,
                references=original_message_id,
            )
            
        except Exception as e:
            logger.exception("Failed to send job opportunity emails")
            return self.Outputs(summary=f"Failed to send job opportunity emails: {str(e)}")

        contact_id = get_contact_id_by_email(self.original_recruiter_email)

        return self.Outputs(
            summary=f"Sent job opportunity response to {self.original_recruiter_email} with BCC to {self.forwarder_email}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                contact_id=contact_id,
                bcc=self.forwarder_email,
                body=self.recruiter_body,
                type=InboxType.EMAIL,
                thread_id=self.thread_id,
            ),
        )
