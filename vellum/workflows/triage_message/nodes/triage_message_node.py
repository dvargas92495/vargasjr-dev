import os
import requests
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode
from .update_crm_node import UpdateCRMNode


def no_action():
    """
    There is no action to take. Skip this message.
    """
    pass


def email_reply(
    body: str,
):
    """
    Reply to the message by sending an email to the sender. Avoid a signature in the body
    of the email, as our template will add one for you.
    """
    pass


def email_initiate(
    to: str,
    subject: str,
    body: str,
):
    """
    Initiate an email to the sender. Form submissions should always prefer this action
    over email_reply, since there are no emails to reply to. Avoid a signature in the body
    of the email, as our template will add one for you.
    """
    pass


def text_reply(
    phone_number: str,
    message: str,
):
    """
    Reply to the message by sending a text message to the sender.
    """
    pass


def slack_reply(
    channel: str,
    to: str,
    message: str,
):
    """
    Reply to the message by sending a Slack message to the sender. Because this is Slack,
    the message should be somewhat informal. You do not need to say things like "I've received
    your message" because that is implicit in your reply.
    """
    requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": f"Bearer {os.environ['SLACK_BOT_TOKEN']}",
            "Content-Type": "application/json",
        },
        json={
            "channel": f"#{channel}",
            "text": f"<@{to}> {message}",
        },
    )


def job_opportunity_recruiter_response(
    original_recruiter_email: str,
    subject: str,
    body: str,
):
    """
    Send an enthusiastic response to the original recruiter about a job opportunity that was
    forwarded to you. The response should express excitement about the role and highlight
    relevant experience to maximize chances of getting an initial interview. Extract the
    original recruiter's email from the forwarded message content.
    """
    pass


def job_opportunity_forwarder_confirmation(
    body: str,
):
    """
    Send a confirmation email to the person who forwarded the job opportunity, letting them
    know that you have reached out to the recruiter. The body should include a link to the
    admin message at /admin/inboxes/{inbox_id}/messages/{message_id} where they can view
    your response to the recruiter.
    """
    pass


class TriageMessageNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are triaging the latest unread message from your inbox. It was from \
{{ contact }} and was submitted via {{ channel }}. Pick the most relevant action. Your message should \
give the recipient confidence that you will be tending to their request and that you are working on it now.

For job opportunities that have been forwarded to you:
- Use job_opportunity_recruiter_response to send an enthusiastic response to the original recruiter
- Use job_opportunity_forwarder_confirmation to confirm with the forwarder that you've responded
- Extract the original recruiter's email address from the forwarded message content
- Look for patterns like "From:", "Sent by:", or email signatures in forwarded messages""",
                ),
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=[
                JinjaPromptBlock(
                    template="""\
{{ message }}
""",
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "contact": UpdateCRMNode.Outputs.contact["identifier"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
    }
    functions = [
        no_action,
        email_reply,
        email_initiate,
        text_reply,
        slack_reply,
        job_opportunity_recruiter_response,
        job_opportunity_forwarder_confirmation,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
