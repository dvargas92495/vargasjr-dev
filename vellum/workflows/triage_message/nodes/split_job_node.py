import logging
from datetime import datetime, timedelta, UTC
from typing import List
from uuid import UUID
from vellum.workflows.nodes import BaseNode
from services import postgres_session
from services.github_auth import get_github_auth_headers, GitHubAppAuthError
from models.job import Job
from models.contact_github_repo import ContactGithubRepo
from sqlmodel import select
from .read_message_node import ReadMessageNode
from .parse_job_function_call_node import ParseJobFunctionCallNode
import requests

logger = logging.getLogger(__name__)

GITHUB_ORG = "vargasjr-dev"


class SplitJobNode(BaseNode):
    job_id = ReadMessageNode.Outputs.job["job_id"]
    contact_id = ReadMessageNode.Outputs.job["contact_id"]
    sub_jobs = ParseJobFunctionCallNode.Outputs.parameters["sub_jobs"]
    repo = ParseJobFunctionCallNode.Outputs.parameters["repo"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            repo = self.repo
            
            if repo:
                # Check if this is a new repo name (no slash) or existing repo (has slash)
                if "/" not in repo:
                    # Create new repo in the vargasjr-dev org
                    created_repo = self._create_repo_for_job(repo)
                    if not created_repo:
                        return self.Outputs(
                            summary=f"Failed to create repository '{repo}' in {GITHUB_ORG} org"
                        )
                    repo = created_repo
            else:
                # No repo specified, try to find one for the contact
                repo = self._find_repo_for_contact()
                if not repo:
                    return self.Outputs(
                        summary="No repository specified and no associated repo found for contact. Please specify a repo name."
                    )
            
            try:
                headers = get_github_auth_headers()
            except GitHubAppAuthError as e:
                return self.Outputs(summary=f"Error getting GitHub auth headers: {str(e)}")
            
            created_jobs: List[dict] = []
            sub_jobs_list = self.sub_jobs if isinstance(self.sub_jobs, list) else []
            
            for i, sub_job in enumerate(sub_jobs_list):
                sub_job_name = sub_job.get("name", f"Sub-job {i + 1}")
                sub_job_description = sub_job.get("description", "")
                sub_job_priority = sub_job.get("priority", 1.0)
                
                issue_body = f"{sub_job_description}\n\n---\nParent Job ID: {self.job_id}"
                
                response = requests.post(
                    f"https://api.github.com/repos/{repo}/issues",
                    headers=headers,
                    json={
                        "title": sub_job_name,
                        "body": issue_body,
                    },
                    timeout=10,
                )
                
                if response.status_code != 201:
                    logger.error(f"Failed to create GitHub issue: {response.status_code} - {response.text}")
                    continue
                
                issue_data = response.json()
                issue_url = issue_data["html_url"]
                issue_number = issue_data["number"]
                
                with postgres_session() as session:
                    job = Job(
                        name=f"#{issue_number}: {sub_job_name}",
                        description=sub_job_description,
                        due_date=datetime.now(UTC) + timedelta(days=7),
                        priority=sub_job_priority,
                        contact_id=self.contact_id,
                        external_url=issue_url,
                        parent_job_id=self.job_id,
                    )
                    session.add(job)
                    session.commit()
                    session.refresh(job)
                    
                    created_jobs.append({
                        "job_id": str(job.id),
                        "issue_number": issue_number,
                        "issue_url": issue_url,
                    })
            
            if not created_jobs:
                return self.Outputs(
                    summary=f"Failed to create any sub-jobs for job {self.job_id}"
                )
            
            summary_parts = [f"Split job {self.job_id} into {len(created_jobs)} sub-jobs:"]
            for job_info in created_jobs:
                summary_parts.append(f"  - Issue #{job_info['issue_number']}: {job_info['issue_url']}")
            
            return self.Outputs(summary="\n".join(summary_parts))
            
        except Exception as e:
            logger.exception(f"Error splitting job: {str(e)}")
            return self.Outputs(summary=f"Error splitting job: {str(e)}")
    
    def _find_repo_for_contact(self) -> str | None:
        if not self.contact_id:
            return None
        
        with postgres_session() as session:
            statement = select(ContactGithubRepo).where(
                ContactGithubRepo.contact_id == self.contact_id
            ).limit(1)
            repo = session.exec(statement).first()
            
            if repo:
                return f"{repo.repo_owner}/{repo.repo_name}"
        
        return None
    
    def _create_repo_for_job(self, repo_name: str) -> str | None:
        """Create a new repository in the vargasjr-dev org via GitHub API."""
        try:
            headers = get_github_auth_headers()
        except GitHubAppAuthError as e:
            logger.error(f"Error getting GitHub auth headers for repo creation: {str(e)}")
            return None
        
        response = requests.post(
            f"https://api.github.com/orgs/{GITHUB_ORG}/repos",
            headers=headers,
            json={
                "name": repo_name,
                "private": True,
                "auto_init": True,
            },
            timeout=10,
        )
        
        if response.status_code == 201:
            logger.info(f"Successfully created repository {GITHUB_ORG}/{repo_name}")
            return f"{GITHUB_ORG}/{repo_name}"
        elif response.status_code == 422:
            # Repository might already exist, try to use it
            logger.info(f"Repository {GITHUB_ORG}/{repo_name} may already exist, attempting to use it")
            return f"{GITHUB_ORG}/{repo_name}"
        else:
            logger.error(f"Failed to create repository: {response.status_code} - {response.text}")
            return None
