import logging
from typing import Optional
from uuid import UUID
from models.outbox_message import OutboxMessage
from models.types import InboxType
from services.aws import send_email
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode

logger = logging.getLogger(__name__)


class JobOpportunityResponseNode(BaseNode):
    original_recruiter_email = ParseFunctionCallNode.Outputs.parameters["original_recruiter_email"]
    recruiter_subject = ParseFunctionCallNode.Outputs.parameters["recruiter_subject"]
    recruiter_body = ParseFunctionCallNode.Outputs.parameters["recruiter_body"]
    forwarder_confirmation_body = ParseFunctionCallNode.Outputs.parameters["forwarder_confirmation_body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
    forwarder_email = ReadMessageNode.Outputs.message["contact_email"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: OutboxMessage

    def run(self) -> BaseNode.Outputs:
        try:
            send_email(
                to=self.original_recruiter_email,
                body=self.recruiter_body,
                subject=self.recruiter_subject,
            )
            
            send_email(
                to=self.forwarder_email,
                body=self.forwarder_confirmation_body,
                subject="Confirmation: Responded to Job Opportunity",
            )
            
        except Exception:
            logger.exception("Failed to send job opportunity emails")
            return self.Outputs(summary="Failed to send job opportunity emails.")  # type: ignore

        return self.Outputs(
            summary=f"Sent job opportunity response to {self.original_recruiter_email} and confirmation to {self.forwarder_email}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=self.recruiter_body,
                type=InboxType.EMAIL,
                thread_id=self.thread_id,
            ),
        )
