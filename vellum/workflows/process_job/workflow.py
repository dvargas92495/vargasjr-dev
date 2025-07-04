import logging
from typing import Optional
from uuid import UUID
from sqlmodel import select
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from models.job import Job
from models.job_session import JobSession
from services import postgres_session

logger = logging.getLogger(__name__)


class JobData(UniversalBaseModel):
    job_id: UUID
    name: str
    description: Optional[str]
    priority: float


class ReadJobNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        job: Optional[JobData]

    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                statement = (
                    select(Job)
                    .order_by(Job.priority.desc())
                    .limit(1)
                )
                
                result = session.exec(statement).first()
                
                if not result:
                    return self.Outputs(job=None)
                
                job_data = JobData(
                    job_id=result.id,
                    name=result.name,
                    description=result.description,
                    priority=result.priority
                )
                
                return self.Outputs(job=job_data)
                
        except Exception as e:
            logger.exception("Failed to read job from database")
            return self.Outputs(job=None)


class CreateJobSessionNode(BaseNode):
    job = ReadJobNode.Outputs.job
    
    class Outputs(BaseNode.Outputs):
        summary: str
        job_session_id: Optional[UUID]

    def run(self) -> Outputs:
        if not self.job:
            return self.Outputs(
                summary="No jobs available to process",
                job_session_id=None
            )
        
        try:
            with postgres_session() as session:
                job_session = JobSession(job_id=self.job.job_id)
                session.add(job_session)
                session.commit()
                
                return self.Outputs(
                    summary=f"Created job session for job '{self.job.name}' (priority: {self.job.priority})",
                    job_session_id=job_session.id
                )
                
        except Exception as e:
            logger.exception(f"Failed to create job session for job {self.job.job_id}")
            return self.Outputs(
                summary=f"Failed to create job session for job '{self.job.name}'",
                job_session_id=None
            )


class ProcessJobWorkflow(BaseWorkflow):
    graph = ReadJobNode >> CreateJobSessionNode

    class Outputs(BaseWorkflow.Outputs):
        summary = CreateJobSessionNode.Outputs.summary
        job_session_id = CreateJobSessionNode.Outputs.job_session_id
