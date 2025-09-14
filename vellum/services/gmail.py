import json
import os
from datetime import datetime, timedelta
from typing import Any, List, Dict, Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64
from services import get_application_by_name
from services.aws import send_email as aws_send_email


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
]


def get_gmail_service() -> Any:
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
