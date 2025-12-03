import logging
from datetime import datetime, timedelta, UTC
from typing import Optional
from vellum.workflows.nodes import BaseNode
from services import ActionRecord, postgres_session
from models.job import Job
from models.contact import Contact
from sqlmodel import select
from .read_message_node import ReadMessageNode
from .triage_message_node import TriageMessageNode

logger = logging.getLogger(__name__)


class CreateProjectNode(BaseNode):
    contact_id = ReadMessageNode.Outputs.message["contact_id"]
    title = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["title"]
    spec_url = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["spec_url"]
    summary = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["summary"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            contact_identifier = "contact"
            with postgres_session() as session:
                statement = select(Contact).where(Contact.id == self.contact_id)
                contact = session.exec(statement).first()
                if contact:
                    contact_identifier = contact.identifier or contact.email or contact.phone_number or str(self.contact_id)
                
                external_url: Optional[str] = self.spec_url if self.spec_url else None
                
                job = Job(
                    name=f"Project: {self.title}",
                    description=self.summary,
                    due_date=datetime.now(UTC) + timedelta(days=14),
                    priority=1.0,
                    contact_id=self.contact_id,
                    external_url=external_url,
                )
                session.add(job)
                session.commit()
                session.refresh(job)
                
                result = f"Created project '{self.title}' for {contact_identifier}"
                if external_url:
                    result += f" with spec URL: {external_url}"
                
                self._append_action_history("create_project", {
                    "title": self.title,
                    "spec_url": self.spec_url,
                    "summary": self.summary,
                    "job_id": str(job.id),
                }, result)
                return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error creating project: {str(e)}")
            result = f"Error creating project: {str(e)}"
            self._append_action_history("create_project", {
                "title": self.title,
                "spec_url": self.spec_url,
                "summary": self.summary,
            }, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
