import os
import requests
from typing import List
from uuid import UUID
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode
from ..state import State
from services import postgres_session
from sqlmodel import select
from models.inbox_message import InboxMessage
from models.inbox import Inbox


def get_message_history(message_id: str) -> str:
    """
    Retrieve the last 5 messages from the same contact or inbox as the given message.
    This provides conversation context to help understand the message history.
    
    Args:
        message_id: The UUID of the message to get history for
    
    Returns:
        A formatted string containing the last 5 messages with timestamps and bodies
    """
    try:
        message_uuid = UUID(message_id)
        
        with postgres_session() as session:
            current_message_stmt = select(InboxMessage).where(InboxMessage.id == message_uuid)
            current_message = session.exec(current_message_stmt).one_or_none()
            
            if not current_message:
                return f"Message with ID {message_id} not found"
            
            history_stmt = (
                select(InboxMessage, Inbox.name)
                .join(Inbox, Inbox.id == InboxMessage.inbox_id)
                .where(InboxMessage.contact_id == current_message.contact_id)
                .where(InboxMessage.id != message_uuid)
                .order_by(InboxMessage.created_at.desc())
                .limit(5)
            )
            
            results = session.exec(history_stmt).all()
            
            if not results:
                return "No previous messages found from this contact"
            
            history_lines = []
            for message, inbox_name in results:
                timestamp = message.created_at.strftime("%Y-%m-%d %H:%M:%S")
                history_lines.append(f"[{timestamp}] via {inbox_name}: {message.body}")
            
            return "\n".join(history_lines)
            
    except ValueError:
        return f"Invalid message ID format: {message_id}"
    except Exception as e:
        return f"Error retrieving message history: {str(e)}"


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
):
    """
    Handle a job opportunity that was forwarded to you by sending a response to the original 
    recruiter while BCC'ing the person who forwarded the opportunity.
    
    Use this function when:
    - A job opportunity has been forwarded to you from another person
    - The message contains job-related content like positions, roles, opportunities, recruitment
    - You need to respond to the original recruiter while keeping the forwarder in the loop
    
    To detect job opportunities, look for:
    - Keywords like "job", "position", "role", "opportunity", "hiring", "recruitment"
    - Forwarded email patterns with "FWD:", "Fwd:", "Forward:", etc. in subject
    - Email content that mentions companies, job titles, or recruiting
    
    To extract the original recruiter's email, look for:
    - "From:" lines in the forwarded message body
    - "Sent by:" or similar forwarding indicators
    - Email signatures or contact information in the forwarded content
    - Original sender information preserved in forwarding headers
    
    IMPORTANT: You are Vargas JR, a fully automated senior-level software developer available 
    for hire. When responding to recruiters, write in FIRST PERSON as Vargas JR expressing YOUR 
    interest in the opportunity. DO NOT write as if you are the forwarder or impersonate anyone 
    else. Introduce yourself as Vargas JR, highlight your capabilities as an AI software developer, 
    express genuine interest in the role, and explain how your automated development skills could 
    benefit their team. The forwarder will automatically receive a BCC copy of your response to 
    stay informed.
    
    CRITICAL: In your initial paragraph, acknowledge that while this email was originally intended 
    for the person who forwarded it, that person is not currently available for new work. However, 
    emphasize that because Vargas JR is infinitely scalable and fully automated, you are available 
    and eager to discuss the opportunity.
    """
    pass


def create_meeting(
    scheduling_link: str,
):
    """
    Schedule a meeting using a scheduling link (Cal.com, Calendly, etc.).
    
    Use this function when:
    - The message contains a scheduling link (e.g., cal.com, calendly.com, etc.)
    - Someone is asking you to schedule a meeting or book time
    - A link is provided for booking an appointment
    
    To detect scheduling links, look for:
    - URLs containing "cal.com", "calendly.com", "reclaim.ai", "motion.com"
    - Phrases like "book a time", "schedule a meeting", "pick a time", "here's my calendar"
    - Links in the message body that appear to be for scheduling
    
    The system will automatically schedule the earliest available slot using the contact's
    information from the message. After scheduling, you will be prompted again to craft
    an appropriate response with the meeting details.
    
    IMPORTANT: If you see in the action_history that a previous create_meeting attempt failed,
    DO NOT try to call create_meeting again. Instead, inform the recipient that you don't know
    how to schedule meetings yet and ask if it would be possible to continue the conversation
    over email instead.
    """
    pass


class TriageMessageNode(BaseInlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are triaging the latest unread message from your inbox. It was submitted via {{ channel }}. \
The contact details are:
{% if contact_full_name %}- Full name: {{ contact_full_name }}
{% endif %}{% if contact_email %}- Email: {{ contact_email }}
{% endif %}{% if contact_slack_display_name %}- Slack display name: {{ contact_slack_display_name }}
{% endif %}{% if contact_phone_number %}- Phone number: {{ contact_phone_number }}
{% endif %}
{% if action_history %}
Previous actions taken:
{% for action in action_history %}- {{ action.name }}: {{ action.result }}
{% endfor %}
{% endif %}
Pick the most relevant action. Your message should give the recipient confidence that you will be tending to \
their request and that you are working on it now.

When someone asks identity questions like "who are you", "what do you do", or "tell me about yourself", \
use text_reply. Keep it to 1-2 short sentences in a casual, conversational tone. End with a direct \
call-to-action to start a project now by offering to share a brief plan and price and asking for a quick \
yes/no to proceed. Keep it conversational and guide them toward committing to hire you.""",
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
        "contact_full_name": ReadMessageNode.Outputs.message["contact_full_name"],
        "contact_email": ReadMessageNode.Outputs.message["contact_email"],
        "contact_slack_display_name": ReadMessageNode.Outputs.message["contact_slack_display_name"],
        "contact_phone_number": ReadMessageNode.Outputs.message["contact_phone_number"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
        "action_history": State.action_history,
    }
    functions = [
        no_action,
        email_reply,
        email_initiate,
        text_reply,
        slack_reply,
        job_opportunity_response,
        create_meeting,
        get_message_history,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
