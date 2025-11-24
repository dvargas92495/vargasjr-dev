import logging
from vellum.workflows.nodes import BaseNode
from services import ActionRecord, postgres_session
from models.job import Job
from models.job_session import JobSession
from models.contact import Contact
from sqlmodel import select
from .read_message_node import ReadMessageNode
from .process_job_node import ProcessJobNode

logger = logging.getLogger(__name__)


class GetJobContextNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                # Fetch job details
                job_statement = select(Job).where(Job.id == self.job_id)
                job = session.exec(job_statement).first()
                
                if not job:
                    result = "Job not found."
                    self._append_action_history("get_job_context", {"job_id": str(self.job_id)}, result)
                    return self.Outputs(summary=result)
                
                context_parts = [f"Job: {job.name}"]
                
                if job.description:
                    context_parts.append(f"Description: {job.description}")
                
                # Fetch contact information if available
                if job.contact_id:
                    contact_statement = select(Contact).where(Contact.id == job.contact_id)
                    contact = session.exec(contact_statement).first()
                    if contact:
                        contact_info = []
                        if contact.full_name:
                            contact_info.append(f"Name: {contact.full_name}")
                        if contact.email:
                            contact_info.append(f"Email: {contact.email}")
                        if contact.phone_number:
                            contact_info.append(f"Phone: {contact.phone_number}")
                        if contact_info:
                            context_parts.append(f"Contact: {', '.join(contact_info)}")
                
                # Fetch previous job sessions
                session_statement = (
                    select(JobSession)
                    .where(JobSession.job_id == self.job_id)
                    .order_by(JobSession.created_at.desc())  # type: ignore
                )
                sessions = session.exec(session_statement).all()
                
                if sessions:
                    context_parts.append(f"Previous sessions: {len(sessions)}")
                    for idx, job_session in enumerate(sessions[:3], 1):
                        session_info = f"Session {idx}: Started {job_session.created_at}"
                        if job_session.end_at:
                            session_info += f", Ended {job_session.end_at}"
                        else:
                            session_info += " (still running)"
                        context_parts.append(session_info)
                
                result = "\n".join(context_parts)
                self._append_action_history("get_job_context", {"job_id": str(self.job_id)}, result)
                return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error getting job context: {str(e)}")
            result = f"Error getting job context: {str(e)}"
            self._append_action_history("get_job_context", {"job_id": str(self.job_id)}, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
