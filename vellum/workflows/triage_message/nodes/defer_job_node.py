import logging
from vellum.workflows.nodes import BaseNode
from services import ActionRecord
from .read_message_node import ReadMessageNode

logger = logging.getLogger(__name__)


class DeferJobNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
        message_url: str
    
    def run(self) -> Outputs:
        # Deferring a job means we don't take any action on it now
        # The job will remain in the queue for future processing
        result = f"Job deferred for later processing."
        self._append_action_history("defer_job", {"job_id": str(self.job_id)}, result)
        return self.Outputs(summary=result, message_url="")
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
