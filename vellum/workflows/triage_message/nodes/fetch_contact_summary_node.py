from typing import List, Optional
from vellum.workflows.nodes import BaseNode
from services.aws import get_aws_session, generate_s3_key
from services.constants import S3_MEMORY_BUCKET
from services import postgres_session
from sqlmodel import select
from models.contact_github_repo import ContactGithubRepo
from uuid import UUID
from .read_message_node import ReadMessageNode


class FetchContactSummaryNode(BaseNode):
    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        current_summary: Optional[str]
        contact_id: str
        repos: List[str]

    def run(self) -> Outputs:
        contact_id = str(self.message.contact_id)
        current_summary: Optional[str] = None
        repos: List[str] = []
        
        try:
            session = get_aws_session()
            s3_client = session.client("s3")
            bucket_name = S3_MEMORY_BUCKET
            
            base_key = f"contacts/{contact_id}/summary.txt"
            key = generate_s3_key(base_key)
            
            response = s3_client.get_object(Bucket=bucket_name, Key=key)
            current_summary = response["Body"].read().decode("utf-8")
            
            del s3_client
            del session
        except Exception:
            pass
        
        try:
            with postgres_session() as db_session:
                statement = select(ContactGithubRepo).where(
                    ContactGithubRepo.contact_id == UUID(contact_id)
                )
                contact_repos = db_session.exec(statement).all()
                repos = [f"{repo.repo_owner}/{repo.repo_name}" for repo in contact_repos]
        except Exception:
            pass
        
        return self.Outputs(
            current_summary=current_summary,
            contact_id=contact_id,
            repos=repos
        )
