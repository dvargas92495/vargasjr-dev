from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode
from .schedule_meeting_node import ScheduleMeetingNode


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
    pass


class TriageMessageFollowupNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You have just processed a meeting scheduling request. The meeting scheduling result is:

{{ meeting_summary }}
{% if meeting_url %}- Meeting URL: {{ meeting_url }}
{% endif %}{% if starts_at %}- Starts at: {{ starts_at }}
{% endif %}{% if ends_at %}- Ends at: {{ ends_at }}
{% endif %}{% if provider %}- Provider: {{ provider }}
{% endif %}

The original message was submitted via {{ channel }}. The contact details are:
{% if contact_full_name %}- Full name: {{ contact_full_name }}
{% endif %}{% if contact_email %}- Email: {{ contact_email }}
{% endif %}{% if contact_slack_display_name %}- Slack display name: {{ contact_slack_display_name }}
{% endif %}{% if contact_phone_number %}- Phone number: {{ contact_phone_number }}
{% endif %}

Now craft an appropriate response to inform the contact about the meeting scheduling result. \
Choose the appropriate channel (email_reply, email_initiate, text_reply, or slack_reply) based on \
how the original message was submitted. Your response should be professional and include the relevant \
meeting details.""",
                ),
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=[
                JinjaPromptBlock(
                    template="""\
Original message: {{ message }}
""",
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "meeting_summary": ScheduleMeetingNode.Outputs.meeting_result["summary"],
        "meeting_url": ScheduleMeetingNode.Outputs.meeting_result["meeting_url"],
        "starts_at": ScheduleMeetingNode.Outputs.meeting_result["starts_at"],
        "ends_at": ScheduleMeetingNode.Outputs.meeting_result["ends_at"],
        "provider": ScheduleMeetingNode.Outputs.meeting_result["provider"],
        "contact_full_name": ReadMessageNode.Outputs.message["contact_full_name"],
        "contact_email": ReadMessageNode.Outputs.message["contact_email"],
        "contact_slack_display_name": ReadMessageNode.Outputs.message["contact_slack_display_name"],
        "contact_phone_number": ReadMessageNode.Outputs.message["contact_phone_number"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
    }
    functions = [
        email_reply,
        email_initiate,
        text_reply,
        slack_reply,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
