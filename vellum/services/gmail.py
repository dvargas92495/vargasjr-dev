import json
import os
from datetime import datetime, timedelta
from typing import Any, List, Dict, Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64
from services import get_application_with_workspace_by_name
from services.aws import send_email as aws_send_email
import requests


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
]


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Refresh the OAuth access token using the refresh token"""
    token_url = "https://oauth2.googleapis.com/token"
    
    response = requests.post(
        token_url,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    
    if not response.ok:
        raise ValueError(f"Failed to refresh access token: {response.text}")
    
    token_data = response.json()
    return token_data["access_token"]


def get_gmail_service() -> Any:
    google_creds = get_application_with_workspace_by_name("Google")
    if not google_creds:
        raise ValueError("Google application not found in database")
    
    if not google_creds.access_token:
        raise ValueError("Google application OAuth tokens not configured. Please connect your Gmail account.")
    
    # Create OAuth credentials
    credentials = Credentials(
        token=google_creds.access_token,
        refresh_token=google_creds.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=google_creds.client_id,
        client_secret=google_creds.client_secret,
        scopes=SCOPES,
    )
    
    if credentials.expired and credentials.refresh_token:
        if not google_creds.client_id or not google_creds.client_secret or not google_creds.refresh_token:
            raise ValueError("Cannot refresh access token: missing client credentials or refresh token")
        
        new_access_token = refresh_access_token(
            google_creds.client_id,
            google_creds.client_secret,
            google_creds.refresh_token
        )
        credentials = Credentials(
            token=new_access_token,
            refresh_token=google_creds.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=google_creds.client_id,
            client_secret=google_creds.client_secret,
            scopes=SCOPES,
        )
    
    service = build("gmail", "v1", credentials=credentials)
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
    import re
    from html import unescape
    
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
    
    return clean_email_content_python(body)


def clean_email_content_python(raw_content: str) -> str:
    """Clean email content to extract only the actual email body"""
    import re
    from html import unescape
    
    if not raw_content or not isinstance(raw_content, str):
        return ''
    
    content = raw_content
    
    if '<html' in content.lower() or '<!doctype' in content.lower():
        content = re.sub(r'<[^>]+>', '', content)
        content = unescape(content)
    
    forwarding_patterns = [
        r'---------- Forwarded message ----------[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)',
        r'Begin forwarded message:[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)',
        r'-----Original Message-----[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)',
        r'From:.*?Sent:.*?To:.*?Subject:.*?(?=\n\n|$)',
        r'On .* wrote:[\s\S]*?(?=\n\n|$)',
    ]
    
    for pattern in forwarding_patterns:
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            forwarding_end = match.end()
            content = content[forwarding_end:].strip()
            break
    
    lines = content.split('\n')
    cleaned_lines = []
    skip_headers = True
    in_signature = False
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        if skip_headers and not line_stripped:
            continue
        
        if skip_headers:
            if re.match(r'^(Return-Path|Received|Message-ID|Date|From|To|Subject|Cc|Bcc|Reply-To|MIME-Version|Content-Type|Content-Transfer-Encoding|X-.*?):\s', line_stripped, re.IGNORECASE):
                continue
            elif line_stripped:
                skip_headers = False
        
        if (re.match(r'^--\s*$', line_stripped) or 
            re.match(r'^_{3,}$', line_stripped) or 
            re.match(r'^-{3,}$', line_stripped) or
            re.match(r'^Sent from my (iPhone|iPad|Android)', line_stripped, re.IGNORECASE) or
            re.match(r'^Get Outlook for', line_stripped, re.IGNORECASE) or
            re.match(r'^This email was sent to .* by', line_stripped, re.IGNORECASE)):
            in_signature = True
        
        if in_signature:
            continue
        
        if not skip_headers:
            cleaned_lines.append(line)
    
    result = '\n'.join(cleaned_lines).strip()
    
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    result = re.sub(r'=\d{2}', '', result)
    result = re.sub(r'=\n', '', result)
    
    return result


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email using AWS SES"""
    try:
        aws_send_email(to=to, subject=subject, body=body)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
