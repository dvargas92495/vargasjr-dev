import logging
from uuid import UUID
from services import postgres_session
from vellum.workflows.nodes import BaseNode
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType
from ..inputs import Inputs

logger = logging.getLogger(__name__)


class ManualArchivedNode(BaseNode):
    message_id = Inputs.message_id

    class Outputs(BaseNode.Outputs):
        success: bool = True
        message: str = "Successfully marked message as archived"

    def run(self) -> Outputs:
        try:
            message_id = UUID(self.message_id)
            execution_id = self._context.execution_context.parent_context.span_id
            
            with postgres_session() as session:
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=message_id,
                        operation=InboxMessageOperationType.ARCHIVED,
                        execution_id=execution_id,
                    )
                )
                session.commit()
                
                logger.info(f"Created ARCHIVED operation for message {message_id} with execution ID {execution_id}")
                
        except Exception as e:
            logger.error(f"Failed to create ARCHIVED operation: {e}")
            return self.Outputs(success=False, message=f"Failed to mark as archived: {str(e)}")
            
        return self.Outputs()
