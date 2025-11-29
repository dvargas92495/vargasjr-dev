import logging
import os
from datetime import datetime, timedelta, UTC
from vellum.workflows.nodes import BaseNode
from services import ActionRecord, postgres_session
from models.job import Job
from models.contact import Contact
from sqlmodel import select
from .read_message_node import ReadMessageNode
from .triage_message_node import TriageMessageNode
import requests

logger = logging.getLogger(__name__)


class CreateTicketNode(BaseNode):
    contact_id = ReadMessageNode.Outputs.message["contact_id"]
    title = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["title"]
    body = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["body"]
    repo = TriageMessageNode.Outputs.results[0]["value"]["arguments"]["repo"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            github_token = os.environ.get("GITHUB_TOKEN")
            if not github_token:
                result = "Error: GITHUB_TOKEN environment variable is not set"
                self._append_action_history("create_ticket", {
                    "title": self.title,
                    "body": self.body,
                    "repo": self.repo,
                }, result)
                return self.Outputs(summary=result)
            
            response = requests.post(
                f"https://api.github.com/repos/{self.repo}/issues",
                headers={
                    "Authorization": f"Bearer {github_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json={
                    "title": self.title,
                    "body": self.body,
                },
            )
            
            if response.status_code != 201:
                result = f"Error creating GitHub issue: {response.status_code} - {response.text}"
                self._append_action_history("create_ticket", {
                    "title": self.title,
                    "body": self.body,
                    "repo": self.repo,
                }, result)
                return self.Outputs(summary=result)
            
            issue_data = response.json()
            issue_url = issue_data["html_url"]
            issue_number = issue_data["number"]
            
            contact_identifier = "contact"
            with postgres_session() as session:
                statement = select(Contact).where(Contact.id == self.contact_id)
                contact = session.exec(statement).first()
                if contact:
                    contact_identifier = contact.identifier or contact.email or contact.phone_number or str(self.contact_id)
                
                job = Job(
                    name=f"Ticket #{issue_number}: {self.title}",
                    description=self.body,
                    due_date=datetime.now(UTC) + timedelta(days=7),
                    priority=1.0,
                    contact_id=self.contact_id,
                    external_url=issue_url,
                )
                session.add(job)
                session.commit()
                session.refresh(job)
                
                result = f"Created GitHub issue #{issue_number} in {self.repo}: {issue_url}"
                self._append_action_history("create_ticket", {
                    "title": self.title,
                    "body": self.body,
                    "repo": self.repo,
                    "issue_url": issue_url,
                    "job_id": str(job.id),
                }, result)
                return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error creating ticket: {str(e)}")
            result = f"Error creating ticket: {str(e)}"
            self._append_action_history("create_ticket", {
                "title": self.title,
                "body": self.body,
                "repo": self.repo,
            }, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
