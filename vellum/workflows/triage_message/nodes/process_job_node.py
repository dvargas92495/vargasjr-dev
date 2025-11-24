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


def complete_job():
    """
    Mark the job as complete by creating a job session with an end time.
    Use this when you have successfully completed the job's requirements.
    """
    pass


def defer_job():
    """
    Defer the job for later processing. Use this when you need more information
    or when the job cannot be completed at this time.
    """
    pass


def get_job_context(job_id: Optional[str] = None) -> str:
    """
    Retrieve additional context about the job, including related contact information
    and any previous job sessions.
    
    Args:
        job_id: Optional UUID of the job to get context for. If not provided,
                uses the current job being processed.
    
    Returns:
        A formatted string containing job context and history
    """
    raise NotImplementedError("Tool stub. Implemented in GetJobContextNode.")


class ProcessJobNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
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

Your task is to work on this job. You have access to tools to:
1. Get additional context about the job (get_job_context)
2. Complete the job when finished (complete_job)
3. Defer the job if you need more information or cannot complete it now (defer_job)

Start by understanding what the job requires, then take appropriate action. If the job description
provides clear instructions, follow them. If you need more context, use get_job_context first.""",
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
        get_job_context,
        complete_job,
        defer_job,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
