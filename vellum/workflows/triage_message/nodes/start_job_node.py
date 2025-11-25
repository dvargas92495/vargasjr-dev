import logging
from datetime import datetime, UTC
from vellum.workflows.nodes import BaseNode
from services import postgres_session
from models.job_session import JobSession
from .read_message_node import ReadMessageNode

logger = logging.getLogger(__name__)


class StartJobNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                # Create a new job session to mark the start of work
                job_session = JobSession(
                    job_id=self.job_id,
                    created_at=datetime.now(UTC),
                    end_at=None,
                )
                session.add(job_session)
                session.commit()
                
                summary = f"Started working on job {self.job_id}. Job session created."
                logger.info(summary)
                return self.Outputs(summary=summary)
                
        except Exception as e:
            logger.exception(f"Error starting job: {str(e)}")
            error_message = f"Error starting job: {str(e)}"
            return self.Outputs(summary=error_message)
