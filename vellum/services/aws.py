from datetime import datetime
import boto3
import os
from logging import Logger
from services.constants import MEMORY_DIR
from email.utils import formataddr
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email import message_from_bytes
from email.message import Message
from typing import Any, Optional


def get_region() -> str:
    """Get AWS region from environment variables or default to us-east-1."""
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


def get_aws_session() -> boto3.Session:
    """Get AWS session for vargasjr-vellum user."""
    region = get_region()
    return boto3.Session(region_name=region)


def generate_s3_key(base_key: str) -> str:
    """
    Generate S3 key with environment-specific prefix.
    
    In production, returns the base key as-is.
    In preview environments, prefixes with previews/{commitSha}/.
    
    Args:
        base_key: The base S3 key (e.g., "contacts/{id}/summary.txt")
    
    Returns:
        The full S3 key with environment-specific prefix
    """
    if os.getenv("VERCEL_ENV") == "production":
        return base_key
    
    preview_id = os.getenv("VERCEL_GIT_COMMIT_SHA", "preview")
    return f"previews/{preview_id}/{base_key}"


def download_memory(logger: Logger):
    session = get_aws_session()
    s3_client = session.client("s3")
    bucket_name = "vargas-jr-memory"
    if not MEMORY_DIR.exists():
        MEMORY_DIR.mkdir(parents=True)
        logger.info(f"Created memory directory: {MEMORY_DIR}")

    # List all objects in the bucket
    objects = s3_client.list_objects_v2(Bucket=bucket_name)

    # Download each file
    for obj in objects.get("Contents", []):
        key = obj["Key"]
        target_path = MEMORY_DIR / key

        # Create directories if they don't exist
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            logger.info(f"Downloading {key} from S3")
            s3_client.download_file(bucket_name, key, str(target_path))
        except Exception:
            logger.exception(f"Failed to download {key} from S3")

    del s3_client
    del session


def send_email(
    to: str,
    body: str,
    subject: str,
    bcc: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> None:
    session = get_aws_session()
    ses_client = session.client("ses")
    if bcc:
        destination: Any = {"ToAddresses": [to], "BccAddresses": [bcc]}
    else:
        destination = {"ToAddresses": [to]}
    
    if in_reply_to or references:
        msg = MIMEMultipart()
        msg["From"] = formataddr(("Vargas JR", "hello@vargasjr.dev"))
        msg["To"] = to
        if bcc:
            msg["Bcc"] = bcc
        msg["Subject"] = subject
        
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = references
        
        msg.attach(MIMEText(body, "plain"))
        
        ses_client.send_raw_email(
            Source=formataddr(("Vargas JR", "hello@vargasjr.dev")),
            Destinations=[to] + ([bcc] if bcc else []),
            RawMessage={"Data": msg.as_string()},
        )
    else:
        ses_client.send_email(
            Source=formataddr(("Vargas JR", "hello@vargasjr.dev")),
            Destination=destination,
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": body}},
            },
        )


def extract_original_message_id(s3_key: str) -> Optional[str]:
    """
    Extract the original recruiter's Message-ID from a raw email stored in S3.
    
    This function fetches the raw MIME message from S3 and attempts to find the
    original Message-ID by:
    1. Looking for a message/rfc822 attachment (forwarded as attachment)
    2. Parsing References or In-Reply-To headers (forwarded inline)
    3. Returning None if no original Message-ID is found
    
    Args:
        s3_key: The S3 key where the raw email is stored (e.g., "emails/{messageId}")
    
    Returns:
        The original Message-ID if found, None otherwise
    """
    try:
        session = get_aws_session()
        s3_client = session.client("s3")
        
        response = s3_client.get_object(
            Bucket="vargas-jr-memory",
            Key=s3_key
        )
        
        raw_email = response["Body"].read()
        msg = message_from_bytes(raw_email)
        
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "message/rfc822":
                    payload = part.get_payload()
                    if isinstance(payload, list) and len(payload) > 0:
                        original_msg = payload[0]
                        if isinstance(original_msg, Message):
                            message_id = original_msg.get("Message-ID")
                            if message_id:
                                return message_id.strip()
        
        references = msg.get("References")
        if references:
            message_ids = references.strip().split()
            if message_ids:
                return message_ids[0].strip()
        
        in_reply_to = msg.get("In-Reply-To")
        if in_reply_to:
            return in_reply_to.strip()
        
        return None
        
    except Exception as e:
        print(f"Failed to extract original Message-ID from {s3_key}: {e}")
        return None


def list_attachments_since(cutoff_date: datetime) -> list[str]:
    session = get_aws_session()
    s3 = session.client("s3")

    # List objects
    recent_objects = []
    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(
        Bucket="vargas-jr-memory",
        Prefix="attachments/",
    ):
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            if obj["LastModified"] >= cutoff_date:
                recent_objects.append(obj["Key"])

    del s3
    del session

    return recent_objects
