from datetime import datetime
import boto3
import os
from logging import Logger
from services.constants import MEMORY_DIR
from email.utils import formataddr
from typing import Any


def get_region() -> str:
    """Get AWS region from environment variables or default to us-east-1."""
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


def get_aws_session() -> boto3.Session:
    """Get AWS session for vargasjr-vellum user."""
    region = get_region()
    return boto3.Session(region_name=region)


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


def send_email(to: str, body: str, subject: str, bcc: str | None = None) -> None:
    session = get_aws_session()
    ses_client = session.client("ses")
    if bcc:
        destination: Any = {"ToAddresses": [to], "BccAddresses": [bcc]}
    else:
        destination = {"ToAddresses": [to]}
    ses_client.send_email(
        Source=formataddr(("Vargas JR", "hello@vargasjr.dev")),
        Destination=destination,
        Message={
            "Subject": {"Data": subject},
            "Body": {"Text": {"Data": body}},
        },
    )


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
