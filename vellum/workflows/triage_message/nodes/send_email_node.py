import logging
from typing import Optional
from uuid import UUID
from models.outbox_message import OutboxMessage
from models.types import InboxType
from services.aws import send_email
from vellum.workflows.nodes import BaseNode

logger = logging.getLogger(__name__)


class SendEmailNode(BaseNode):
    to: str
    subject: str
    body: str
    inbox_message_id: UUID
    thread_id: Optional[str] = None

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
            return self.Outputs(summary=f"Failed to send email to {self.to}.")  # type: ignore

        return self.Outputs(
            summary=f"Sent email to {self.to}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=self.body,
                type=InboxType.EMAIL,
                thread_id=self.thread_id,
            ),
        )
