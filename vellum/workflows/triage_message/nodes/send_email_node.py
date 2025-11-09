import logging
from typing import Optional
from uuid import UUID
from models.outbox_message import OutboxMessage
from models.outbox_message_recipient import OutboxMessageRecipient
from models.types import InboxType, OutboxRecipientType
from services.aws import send_email
from services import get_or_create_contact_id_by_email
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
        outbox_message: Optional[OutboxMessage] = None
        recipients: list[OutboxMessageRecipient] = []

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

        to_contact_id = get_or_create_contact_id_by_email(self.to)

        outbox_message = OutboxMessage(
            parent_inbox_message_id=self.inbox_message_id,
            body=self.body,
            type=InboxType.EMAIL,
            thread_id=self.thread_id,
        )

        recipients = [
            OutboxMessageRecipient(
                message_id=outbox_message.id,
                contact_id=to_contact_id,
                type=OutboxRecipientType.TO,
            ),
        ]

        return self.Outputs(
            summary=f"Sent email to {self.to}.",
            outbox_message=outbox_message,
            recipients=recipients,
        )
