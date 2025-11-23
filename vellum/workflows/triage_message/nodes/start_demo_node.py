import logging
from datetime import datetime, timedelta, UTC
from vellum.workflows.nodes import BaseNode
from services import ActionRecord, postgres_session
from models.job import Job
from models.contact import Contact
from sqlmodel import select
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
            # Fetch contact information to create a meaningful job name
            contact_identifier = "contact"
            with postgres_session() as session:
                statement = select(Contact).where(Contact.id == self.contact_id)
                contact = session.exec(statement).first()
                if contact:
                    contact_identifier = contact.identifier or contact.email or contact.phone_number or str(self.contact_id)
                
                # Create a job for demo creation that another agent can pick up
                job = Job(
                    name=f"Create demo for {contact_identifier}",
                    description=self.project_summary,
                    due_date=datetime.now(UTC) + timedelta(days=1),
                    priority=1.0,
                    contact_id=self.contact_id,
                )
                session.add(job)
                session.commit()
                session.refresh(job)
                
                result = "Demo creation job has been queued."
                self._append_action_history("start_demo", {"project_summary": self.project_summary, "job_id": str(job.id)}, result)
                return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error creating demo job: {str(e)}")
            result = f"Error creating demo job: {str(e)}"
            self._append_action_history("start_demo", {"project_summary": self.project_summary}, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
