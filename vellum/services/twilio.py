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
    
    account_sid = application.client_id.strip()
    if account_sid[:2].lower() == "ac":
        account_sid = "AC" + account_sid[2:]
    
    auth_token = application.client_secret.strip()
    
    client = Client(account_sid, auth_token)
    
    client.messages.create(
        to=to,
        from_=from_,
        body=body
    )
