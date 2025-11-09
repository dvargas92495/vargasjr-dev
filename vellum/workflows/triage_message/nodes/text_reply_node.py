from uuid import UUID
from typing import Optional
from models.outbox_message import OutboxMessage
from models.types import InboxType
from vellum.workflows.nodes import BaseNode
from services.twilio import send_sms
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class TextReplyNode(BaseNode):
    phone_number = ParseFunctionCallNode.Outputs.parameters["phone_number"]
    message = ParseFunctionCallNode.Outputs.parameters["message"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
    inbox_name = ReadMessageNode.Outputs.message["inbox_name"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: Optional[OutboxMessage] = None

    def run(self) -> BaseNode.Outputs:
        from services import get_contact_id_by_phone_number
        
        from_phone = self.inbox_name.replace("twilio-phone-", "")
        
        send_sms(
            to=self.phone_number,
            from_=from_phone,
            body=self.message
        )
        
        contact_id = get_contact_id_by_phone_number(self.phone_number)
        
        return self.Outputs(
            summary=f"Sent text message to {self.phone_number}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                contact_id=contact_id,
                body=self.message,
                type=InboxType.SMS,
                thread_id=self.thread_id,
            ),
        )
