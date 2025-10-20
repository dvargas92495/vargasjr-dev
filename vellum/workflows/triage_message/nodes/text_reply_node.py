import os
from uuid import UUID
from typing import Optional
from twilio.rest import Client  # type: ignore
from models.outbox_message import OutboxMessage
from models.types import InboxType
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


def send_sms(to: str, from_: str, body: str):
    """
    Send an SMS message via Twilio.
    """
    account_sid = os.environ["TWILIO_ACCOUNT_SID"]
    auth_token = os.environ["TWILIO_AUTH_TOKEN"]
    client = Client(account_sid, auth_token)
    
    client.messages.create(
        to=to,
        from_=from_,
        body=body
    )


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
        from_phone = self.inbox_name.replace("twilio-phone-", "")
        
        send_sms(
            to=self.phone_number,
            from_=from_phone,
            body=self.message
        )
        
        return self.Outputs(
            summary=f"Sent text message to {self.phone_number}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=self.message,
                type=InboxType.SMS,
                thread_id=self.thread_id,
            ),
        )
