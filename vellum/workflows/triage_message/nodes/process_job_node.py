import logging
from typing import Optional
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode


logger = logging.getLogger(__name__)


def start_job():
    """
    Start working on the job by creating a job session.
    Use this when you begin processing the job.
    """
    pass


def complete_job():
    """
    Mark the job as complete when the artifacts generated from all of the job's 
    sessions satisfy the requirements of the job.
    """
    pass


def mark_job_as_blocked(reason: str):
    """
    Mark the job as blocked when you cannot proceed with the job.
    
    Args:
        reason: Explanation of why the job is blocked
    """
    pass


def split_job(sub_jobs: list, repo: Optional[str] = None):
    """
    Split the current job into smaller sub-jobs when the job is too large or complex
    to complete in a single session. Each sub-job will be tracked as a GitHub issue.
    
    Args:
        sub_jobs: List of sub-job definitions, each containing:
            - name: Short descriptive name for the sub-job
            - description: Detailed description of what needs to be done
            - priority: Priority level (1.0 is normal, higher is more urgent)
        repo: Optional GitHub repository (owner/repo format) to create issues in.
              Must be one of: dvargas92495/vargasjr-dev, Cari-AI/cari-ai.
              If not specified, will use the contact's associated repo or default to dvargas92495/vargasjr-dev.
    """
    pass


class ProcessJobNode(BaseInlinePromptNode):
    ml_model = "gpt-5.1"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are processing a job from the jobs queue. The job details are:
- Job ID: {{ job_id }}
- Name: {{ job_name }}
{% if job_description %}- Description: {{ job_description }}
{% endif %}- Due Date: {{ job_due_date }}
- Priority: {{ job_priority }}
{% if contact_id %}- Contact ID: {{ contact_id }}
{% endif %}

Your goal is to complete the requirements of the job.""",
                ),
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=[
                JinjaPromptBlock(
                    template="""Process this job and determine the appropriate action.""",
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "job_id": ReadMessageNode.Outputs.job["job_id"],
        "job_name": ReadMessageNode.Outputs.job["name"],
        "job_description": ReadMessageNode.Outputs.job["description"],
        "job_due_date": ReadMessageNode.Outputs.job["due_date"],
        "job_priority": ReadMessageNode.Outputs.job["priority"],
        "contact_id": ReadMessageNode.Outputs.job["contact_id"],
    }
    functions = [
        start_job,
        complete_job,
        mark_job_as_blocked,
        split_job,
    ]
    parameters = PromptParameters(
        max_tokens=32000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
