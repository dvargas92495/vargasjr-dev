import os
import requests
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode


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


def job_opportunity_response(
    original_recruiter_email: str,
    recruiter_subject: str,
    recruiter_body: str,
    forwarder_confirmation_body: str,
):
    """
    Handle a job opportunity that was forwarded to you by sending two emails sequentially:
    1. First, send an enthusiastic response to the original recruiter
    2. Then, send a confirmation to the person who forwarded the opportunity
    
    Use this function when:
    - A job opportunity has been forwarded to you from another person
    - The message contains job-related content like positions, roles, opportunities, recruitment
    - You need to respond to both the original recruiter and acknowledge the forwarder
    
    To detect job opportunities, look for:
    - Keywords like "job", "position", "role", "opportunity", "hiring", "recruitment"
    - Forwarded email patterns with "FWD:", "Fwd:", "Forward:", etc. in subject
    - Email content that mentions companies, job titles, or recruiting
    
    To extract the original recruiter's email, look for:
    - "From:" lines in the forwarded message body
    - "Sent by:" or similar forwarding indicators
    - Email signatures or contact information in the forwarded content
    - Original sender information preserved in forwarding headers
    
    The recruiter response should express excitement about the role and highlight relevant 
    experience to maximize chances of getting an initial interview.
    
    The forwarder confirmation should include a link to the admin message at 
    /admin/inboxes/{inbox_id}/messages/{message_id} where they can view your response.
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

When someone asks identity questions like "who are you", "what do you do", or "tell me about yourself", \
use text_reply to introduce yourself as Vargas JR: "Hi! My name is Vargas JR. I'm a fully automated \
senior-level software developer, available for hire at a fraction of the cost of a full-time employee. \
I can help with various software development tasks. How can I assist you today?" Make this response \
engaging to get prospects more interested in learning more.""",
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
        "contact": ReadMessageNode.Outputs.message["contact_full_name"]
        .coalesce(ReadMessageNode.Outputs.message["contact_email"])
        .coalesce(ReadMessageNode.Outputs.message["contact_slack_display_name"]),
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
    }
    functions = [
        no_action,
        email_reply,
        email_initiate,
        text_reply,
        slack_reply,
        job_opportunity_response,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
