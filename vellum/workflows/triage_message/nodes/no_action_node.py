from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from services import postgres_session
from models.inbox_message import InboxMessage
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType, InboxType
from sqlmodel import select


class NoActionNode(BaseNode):
    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        summary = "Message archived - no action needed."
        message_url: str

    def run(self) -> BaseNode.Outputs:
        if self.message.channel == InboxType.NONE:
            return self.Outputs(summary="No messages to process", message_url="")
        
        message_url = f"/admin/inboxes/{self.message.inbox_id}/messages/{self.message.message_id}"
        
        with postgres_session() as session:
            message_exists = session.exec(
                select(InboxMessage.id).where(InboxMessage.id == self.message.message_id)
            ).first()
            
            if not message_exists:
                return self.Outputs(summary="Message no longer exists - archived.", message_url=message_url)  # type: ignore
            
            execution_id = self.state.meta.span_id
            
            session.add(
                InboxMessageOperation(
                    inbox_message_id=self.message.message_id,
                    operation=InboxMessageOperationType.ARCHIVED,
                    execution_id=execution_id,
                )
            )
            session.commit()
        
        return self.Outputs(summary="Message archived - no action needed.", message_url=message_url)  # type: ignore
