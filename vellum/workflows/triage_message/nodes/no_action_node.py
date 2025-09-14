from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from services import postgres_session
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType


class NoActionNode(BaseNode):
    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        summary = "Message archived - no action needed."
        message_url: str

    def run(self) -> BaseNode.Outputs:
        message_url = f"/admin/inboxes/{self.message.inbox_id}/messages/{self.message.message_id}"
        
        with postgres_session() as session:
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
