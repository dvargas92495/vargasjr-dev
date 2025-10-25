from typing import Optional
from twilio.rest import Client  # type: ignore[import-untyped]
from services import get_application_by_name


def send_sms(to: str, from_: str, body: str) -> None:
    """
    Send an SMS message via Twilio using credentials from the applications table.
    
    Args:
        to: Recipient phone number (e.g., "+15551234567")
        from_: Sender phone number (e.g., "+15559876543")
        body: Message content
    """
    application = get_application_by_name("Twilio")
    
    if not application:
        raise ValueError("Twilio application not found in database")
    
    if not application.client_id or not application.client_secret:
        raise ValueError("Twilio credentials not configured in database")
    
    client = Client(application.client_id, application.client_secret)
    
    client.messages.create(
        to=to,
        from_=from_,
        body=body
    )
