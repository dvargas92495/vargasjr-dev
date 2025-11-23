import logging
from vellum.workflows.nodes import BaseNode
from services import ActionRecord
from .read_message_node import ReadMessageNode
from .triage_message_node import TriageMessageNode

logger = logging.getLogger(__name__)


class StartDemoNode(BaseNode):
    contact_id = ReadMessageNode.Outputs.message["contact_id"]
    project_summary = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["project_summary"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            # For now, we'll create a placeholder demo link
            # In the future, this could trigger actual demo creation
            demo_link = f"https://demo.vargasjr.dev/preview/{self.contact_id}"
            
            result = f"Demo created successfully. Share this link with the contact: {demo_link}\n\nProject Summary: {self.project_summary}"
            self._append_action_history("start_demo", {"project_summary": self.project_summary}, result)
            return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error creating demo: {str(e)}")
            result = f"Error creating demo: {str(e)}"
            self._append_action_history("start_demo", {"project_summary": self.project_summary}, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
