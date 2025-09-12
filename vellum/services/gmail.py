import json
import os
from datetime import datetime, timedelta
from typing import Any, List, Dict, Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
]


def get_gmail_service() -> Any:
    from services import get_application_by_name
    
    google_app = get_application_by_name("Google")
    if not google_app:
        raise ValueError("Google application not found in database")
    
    if not google_app.client_secret:
        raise ValueError("Google application credentials not properly configured")
    
    google_credentials = Credentials.from_service_account_info(
        json.loads(google_app.client_secret),
        scopes=SCOPES,
    )
    
    user_email = os.getenv("GMAIL_USER_EMAIL", "dvargas92495@gmail.com")
    delegated_credentials = google_credentials.with_subject(user_email)
    
    service = build("gmail", "v1", credentials=delegated_credentials)
    return service


def get_emails_from_last_day() -> List[Dict[str, Any]]:
    """Fetch emails from the last 24 hours"""
    service = get_gmail_service()
    
    yesterday = datetime.now() - timedelta(days=1)
    timestamp = int(yesterday.timestamp())
    
    query = f"after:{timestamp}"
    
    try:
        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=100
        ).execute()
        
        messages = results.get('messages', [])
        emails = []
        
        for message in messages:
            msg = service.users().messages().get(
                userId='me',
                id=message['id'],
                format='full'
            ).execute()
            
            headers = msg['payload'].get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), '')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
            
            body = extract_email_body(msg['payload'])
            
            emails.append({
                'id': message['id'],
                'subject': subject,
                'sender': sender,
                'date': date,
                'body': body,
                'raw_message': msg
            })
            
        return emails
        
    except Exception as e:
        print(f"Error fetching emails: {e}")
        return []


def extract_email_body(payload: Dict[str, Any]) -> str:
    """Extract the body text from email payload"""
    body = ""
    
    if 'parts' in payload:
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                if 'data' in part['body']:
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
            elif part['mimeType'] == 'text/html' and not body:
                if 'data' in part['body']:
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
    else:
        if payload['mimeType'] == 'text/plain':
            if 'data' in payload['body']:
                body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        elif payload['mimeType'] == 'text/html':
            if 'data' in payload['body']:
                body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
    
    return body


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email using AWS SES"""
    try:
        from services.aws import send_email as aws_send_email
        aws_send_email(to=to, subject=subject, body=body)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
