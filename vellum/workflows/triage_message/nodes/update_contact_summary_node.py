from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import InlinePromptNode
from .read_message_node import ReadMessageNode
from .fetch_contact_summary_node import FetchContactSummaryNode


class UpdateContactSummaryNode(InlinePromptNode):
    ml_model = "gpt-5"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are updating a contact summary based on a new message from the contact. \
Your goal is to maintain a concise, informative summary of this contact that captures:
- Their relationship to Vargas JR (client, prospect, recruiter, etc.)
- Key topics they've discussed or requested
- Any important context about their needs or interests
- Notable patterns in their communication

Keep the summary focused and actionable. Update or add new information based on the latest message, \
but preserve important historical context.

IMPORTANT RULES:
1. DO NOT include any contact information in the summary (no email addresses, phone numbers, or Slack IDs). \
This information is tracked separately in our database.
2. If the current summary contains merge markers (lines like "--- Merged from contact ... ---"), this indicates \
that two contact records were merged. In this case, consolidate the information from both sections into a single, \
clean summary without any merge markers. Remove duplicate information and create a unified narrative.

{% if current_summary %}Current summary:
{{ current_summary }}
{% else %}This is the first message from this contact, so there is no existing summary.
{% endif %}

Contact details (for context only - DO NOT include these in the summary):
{% if contact_full_name %}- Full name: {{ contact_full_name }}
{% endif %}{% if contact_email %}- Email: {{ contact_email }}
{% endif %}{% if contact_slack_display_name %}- Slack display name: {{ contact_slack_display_name }}
{% endif %}{% if contact_phone_number %}- Phone number: {{ contact_phone_number }}
{% endif %}{% if repos %}- Associated GitHub repos: {{ repos | join(', ') }}
{% endif %}

Latest message (via {{ channel }}):
{{ message }}

Provide an updated summary that incorporates this new information. If the latest message does not add \
substantive new information and aligns well with the current summary, it's acceptable to keep the summary \
unchanged and return it as-is. Remember: no contact info (emails, phone numbers) in the output, and clean up \
any merge markers if present.""",
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "current_summary": FetchContactSummaryNode.Outputs.current_summary,
        "contact_full_name": ReadMessageNode.Outputs.message["contact_full_name"],
        "contact_email": ReadMessageNode.Outputs.message["contact_email"],
        "contact_slack_display_name": ReadMessageNode.Outputs.message["contact_slack_display_name"],
        "contact_phone_number": ReadMessageNode.Outputs.message["contact_phone_number"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
        "repos": FetchContactSummaryNode.Outputs.repos,
    }
    parameters = PromptParameters(
        max_tokens=32000,
    )
