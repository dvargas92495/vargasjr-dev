from uuid import UUID
from typing import Optional
from models.outbox_message import OutboxMessage
from models.types import InboxType
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class WhoAreYouNode(BaseNode):
    phone_number = ParseFunctionCallNode.Outputs.parameters["phone_number"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: OutboxMessage

    def run(self) -> BaseNode.Outputs:
        identity_message = (
            "Hi! My name is Vargas JR. I'm a fully automated senior-level software developer, "
            "available for hire at a fraction of the cost of a full-time employee. "
            "I can help with various software development tasks. How can I assist you today?"
        )
        
        return self.Outputs(
            summary=f"Introduced VargasJR to {self.phone_number}.",
            outbox_message=OutboxMessage(
                parent_inbox_message_id=self.inbox_message_id,
                body=identity_message,
                type=InboxType.SMS,
                thread_id=self.thread_id,
            ),
        )
