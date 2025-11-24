import logging
from datetime import datetime, UTC
from vellum.workflows.nodes import BaseNode
from services import ActionRecord, postgres_session
from models.job_session import JobSession
from .read_message_node import ReadMessageNode

logger = logging.getLogger(__name__)


class CompleteJobNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
        message_url: str
    
    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                # Create a job session with an end time to mark completion
                job_session = JobSession(
                    job_id=self.job_id,
                    created_at=datetime.now(UTC),
                    end_at=datetime.now(UTC),
                )
                session.add(job_session)
                session.commit()
                session.refresh(job_session)
                
                result = f"Job completed successfully. Session ID: {job_session.id}"
                self._append_action_history("complete_job", {"job_id": str(self.job_id)}, result)
                return self.Outputs(summary=result, message_url="")
                
        except Exception as e:
            logger.exception(f"Error completing job: {str(e)}")
            result = f"Error completing job: {str(e)}"
            self._append_action_history("complete_job", {"job_id": str(self.job_id)}, result)
            return self.Outputs(summary=result, message_url="")
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
