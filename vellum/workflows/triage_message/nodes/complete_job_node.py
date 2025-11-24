import logging
from datetime import datetime, UTC
from vellum.workflows.nodes import BaseNode
from services import postgres_session
from models.job_session import JobSession
from models.job import Job, JobStatus
from sqlmodel import select
from .read_message_node import ReadMessageNode

logger = logging.getLogger(__name__)


class CompleteJobNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
        url: str
    
    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                # Fetch the existing in-progress job session
                active_session = session.exec(
                    select(JobSession)
                    .where(JobSession.job_id == self.job_id)
                    .where(JobSession.end_at.is_(None))  # type: ignore
                ).first()
                
                if not active_session:
                    error_message = f"No active job session found for job {self.job_id}"
                    logger.error(error_message)
                    return self.Outputs(summary=error_message, url="")
                
                # Set the end time on the existing session
                active_session.end_at = datetime.now(UTC)
                
                # Update job status to COMPLETED
                job = session.exec(select(Job).where(Job.id == self.job_id)).first()
                if job:
                    job.status = JobStatus.COMPLETED
                
                session.commit()
                
                summary = f"Job {self.job_id} marked as complete."
                url = f"/admin/jobs/{self.job_id}/sessions/{active_session.id}"
                logger.info(summary)
                return self.Outputs(summary=summary, url=url)
                
        except Exception as e:
            logger.exception(f"Error completing job: {str(e)}")
            error_message = f"Error completing job: {str(e)}"
            return self.Outputs(summary=error_message, url="")
