from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from services import postgres_session
from models.inbox_message import InboxMessage
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType
from sqlmodel import select
from ..inputs import Inputs


class NoActionNode(BaseNode):
    message = ReadMessageNode.Outputs.message
    operation = Inputs.operation

    class Outputs(BaseNode.Outputs):
        summary = "Message archived - no action needed."
        message_url: str

    def run(self) -> BaseNode.Outputs:
        message_url = f"/admin/inboxes/{self.message.inbox_id}/messages/{self.message.message_id}"
        
        # If this is a manual operation, the operation was already created in ReadMessageNode
        if self.operation:
            summary = f"Successfully marked message as {self.operation.lower()}"
            return self.Outputs(summary=summary, message_url=message_url)
        
        with postgres_session() as session:
            message_exists = session.exec(
                select(InboxMessage.id).where(InboxMessage.id == self.message.message_id)
            ).first()
            
            if not message_exists:
                return self.Outputs(summary="Message no longer exists - archived.", message_url=message_url)
            
            execution_id = self._context.execution_context.parent_context.span_id
            
            session.add(
                InboxMessageOperation(
                    inbox_message_id=self.message.message_id,
                    operation=InboxMessageOperationType.ARCHIVED,
                    execution_id=execution_id,
                )
            )
            session.commit()
        
        return self.Outputs(summary="Message archived - no action needed.", message_url=message_url)
