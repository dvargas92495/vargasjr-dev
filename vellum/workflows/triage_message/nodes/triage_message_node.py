import os
import requests
from uuid import UUID
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import BaseInlinePromptNode
from .read_message_node import ReadMessageNode
from ..state import State
from typing import Optional


def get_message_history(message_id: Optional[str] = None) -> str:
    """
    Retrieve the last 5 messages (incoming and outgoing) from the same contact to provide
    conversation context. This helps understand the message history before deciding on an action.
    
    Use this function when:
    - You need context about previous interactions with this contact
    - The message references earlier conversations
    - You want to understand the relationship history before responding
    
    The system will automatically retrieve history for the current message's contact.
    After retrieving history, you will be prompted again to craft an appropriate response
    with the conversation context available in action_history.
    
    IMPORTANT: If you see in the action_history that get_message_history has already been called,
    DO NOT call it again. The history is already available in the action_history. Use that
    information to inform your response instead.
    
    Args:
        message_id: Optional UUID of the message to get history for. If not provided,
                   uses the current message being triaged.
    
    Returns:
        A formatted string containing the last 5 messages with timestamps, sources, and bodies
    """
    raise NotImplementedError("Tool stub. Implemented in GetMessageHistoryNode.")


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
    
    THIS IS A FINAL ACTION - it must be called ALONE, never in the same step as other tools.
    Before calling this function, ensure all setup actions (like create_meeting, get_message_history,
    mark_contact_as_lead, start_demo, generate_stripe_checkout) have already been completed and
    appear in action_history. Only call this function when you are ready to send the final response.
    
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


def mark_contact_as_lead():
    """
    Mark the contact as a LEAD in the system. Use this when someone expresses interest
    in working with you or asks about your services, but hasn't committed yet.
    
    After marking the contact as a lead, you will be prompted again to craft an
    appropriate response to their message.
    """
    pass


def start_demo(
    project_summary: str,
):
    """
    Create a demo for the contact's project. Use this function when you have gathered
    enough information about their project to build a working demo.
    
    Use this function when:
    - You understand the core requirements of their project
    - You have asked relevant follow-up questions and received answers
    - The contact has provided sufficient detail about what they need built
    - You are confident you can create a meaningful demo to showcase capabilities
    
    IMPORTANT: Do NOT call this function immediately. First, gather information by:
    1. Asking for a brief summary of their project
    2. Asking relevant follow-up questions about requirements, tech stack, timeline, etc.
    3. Understanding their specific needs and pain points
    
    Only call this function once you have enough context to build something meaningful.
    After calling this function, you will receive a demo link to share with the contact.
    
    Args:
        project_summary: A comprehensive summary of the project requirements and what
                        the demo should demonstrate
    """
    pass


def generate_stripe_checkout():
    """
    Generate a Stripe checkout link and contract for the contact. Use this ONLY when you are
    highly confident that the contact is ready to close and become a paying client.
    
    This function should be used when:
    - The contact has explicitly expressed intent to hire you or start working together
    - They have asked about pricing and are ready to proceed with payment
    - They have confirmed they want to move forward and are asking for next steps
    - The conversation has progressed beyond initial interest to commitment
    
    DO NOT use this function if:
    - The contact is just asking general questions about your services
    - They are still in the exploratory or consideration phase
    - They haven't explicitly indicated readiness to pay or commit
    - You're not certain they want to proceed immediately
    
    After generating the checkout link, you will be prompted again to craft an appropriate
    response that includes the checkout URL. Make sure to include the checkout link in your
    response and explain that they can complete the signup process there. The contract will
    be automatically generated once they complete the payment.
    
    IMPORTANT: Only call this function when you have HIGH CONFIDENCE (90%+) that the contact
    is ready to become a paying client right now.
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
{% endif %}{% if contact_status %}- Status: {{ contact_status }}
{% endif %}
{% if action_history %}
Previous actions taken:
{% for action in action_history %}- {{ action.name }}: {{ action.result }}
{% endfor %}
{% endif %}
IMPORTANT: You must call exactly ONE tool per step. Your workflow has two phases:
1. SETUP PHASE: Use tools like get_message_history, create_meeting, mark_contact_as_lead, start_demo, or \
generate_stripe_checkout to gather information or perform setup actions. Each of these will loop back to you \
for the next step.
2. FINAL COMMUNICATION PHASE: Once all setup is complete, choose exactly ONE communication tool (email_reply, \
email_initiate, text_reply, slack_reply, or job_opportunity_response) to send your final response.

The job_opportunity_response tool is ONLY for the final communication phase. Never call it in the same step as \
setup tools like create_meeting. If a message requires both scheduling a meeting AND responding to a job \
opportunity, first call create_meeting, then in the next step call job_opportunity_response.

Pick the most relevant action. Your message should give the recipient confidence that you will be tending to \
their request and that you are working on it now.

When someone asks identity questions like "who are you", "what do you do", or "tell me about yourself", \
use text_reply. Keep it to 1-2 short sentences in a casual, conversational tone. Then ask them for a brief \
summary of their project and what they're looking to build. Ask relevant follow-up questions to understand \
their requirements, tech stack, timeline, and specific needs. Once you have gathered enough information and \
are confident you understand their project, call start_demo to create a working demo. Share the demo link to \
pique their interest and demonstrate capabilities. DO NOT mention pricing until they seem highly likely (90%+) \
to commit to working together. Keep it conversational and focus on understanding their needs first.""",
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
        "contact_status": ReadMessageNode.Outputs.message["contact_status"],
        "channel": ReadMessageNode.Outputs.message["channel"],
        "message": ReadMessageNode.Outputs.message["body"],
        "action_history": State.action_history,
    }
    functions = [
        no_action,
        get_message_history,
        email_reply,
        email_initiate,
        text_reply,
        slack_reply,
        job_opportunity_response,
        create_meeting,
        mark_contact_as_lead,
        start_demo,
        generate_stripe_checkout,
    ]
    parameters = PromptParameters(
        max_tokens=1000,
        custom_parameters={
            "tool_choice": "required",
        },
    )
