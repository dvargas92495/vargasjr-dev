from uuid import UUID
from typing import Optional
from models.outbox_message import OutboxMessage
from models.outbox_message_recipient import OutboxMessageRecipient
from models.types import InboxType, OutboxRecipientType
from vellum.workflows.nodes import BaseNode
from services.twilio import send_sms
from services import get_or_create_contact_id_by_phone_number
from .read_message_node import ReadMessageNode
from .parse_function_call_followup_node import ParseFunctionCallFollowupNode


class TextReplyFollowupNode(BaseNode):
    phone_number = ParseFunctionCallFollowupNode.Outputs.parameters["phone_number"]
    message = ParseFunctionCallFollowupNode.Outputs.parameters["message"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
    inbox_name = ReadMessageNode.Outputs.message["inbox_name"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: Optional[OutboxMessage] = None
        recipients: list[OutboxMessageRecipient] = []

    def run(self) -> BaseNode.Outputs:
        from_phone = self.inbox_name.replace("twilio-phone-", "")
        
        send_sms(
            to=self.phone_number,
            from_=from_phone,
            body=self.message
        )
        
        to_contact_id = get_or_create_contact_id_by_phone_number(self.phone_number)
        
        outbox_message = OutboxMessage(
            parent_inbox_message_id=self.inbox_message_id,
            body=self.message,
            type=InboxType.SMS,
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
            summary=f"Sent text message to {self.phone_number}.",
            outbox_message=outbox_message,
            recipients=recipients,
        )
