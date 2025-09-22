import logging
from uuid import UUID
from services import postgres_session
from vellum.workflows.nodes import BaseNode
from vellum.workflows.inputs import BaseInputs
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType

logger = logging.getLogger(__name__)


class ManualOperationNode(BaseNode):
    class Inputs(BaseInputs):
        message_id: str
        operation: str

    class Outputs(BaseNode.Outputs):
        success: bool
        message: str

    def run(self) -> Outputs:
        try:
            message_id = UUID(self.inputs.message_id)
            operation = self.inputs.operation
            
            execution_id = self._context.execution_context.parent_context.span_id
            
            operation_type = InboxMessageOperationType.UNREAD if operation == "UNREAD" else InboxMessageOperationType.ARCHIVED
            
            with postgres_session() as session:
                session.add(
                    InboxMessageOperation(
                        inbox_message_id=message_id,
                        operation=operation_type,
                        execution_id=execution_id,
                    )
                )
                session.commit()
                
                logger.info(f"Created {operation} operation for message {message_id} with execution ID {execution_id}")
                
                return self.Outputs(
                    success=True,
                    message=f"Successfully marked message as {operation.lower()}"
                )
                
        except Exception as e:
            logger.error(f"Failed to create manual operation: {e}")
            return self.Outputs(
                success=False,
                message=f"Failed to create operation: {str(e)}"
            )
