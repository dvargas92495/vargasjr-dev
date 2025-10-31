import os
from twilio.rest import Client  # type: ignore[import-untyped]


def send_sms(to: str, from_: str, body: str) -> None:
    """
    Send an SMS message via Twilio using credentials from environment variables.
    
    Args:
        to: Recipient phone number (e.g., "+15551234567")
        from_: Sender phone number (e.g., "+15559876543")
        body: Message content
    
    Environment Variables:
        TWILIO_ACCOUNT_SID: Twilio account SID
        TWILIO_AUTH_TOKEN: Twilio authentication token
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if not account_sid:
        raise ValueError("TWILIO_ACCOUNT_SID environment variable is not set")
    
    if not auth_token:
        raise ValueError("TWILIO_AUTH_TOKEN environment variable is not set")
    
    client = Client(account_sid, auth_token)
    
    client.messages.create(
        to=to,
        from_=from_,
        body=body
    )
