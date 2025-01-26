from datetime import datetime
import boto3
from logging import Logger
from src.services import MEMORY_DIR
from email.utils import formataddr


def download_memory(logger: Logger):
    s3_client = boto3.client("s3")
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


def send_email(to: str, body: str, subject: str) -> None:
    ses_client = boto3.client("ses")
    ses_client.send_email(
        Source=formataddr(("Vargas JR", "hello@vargasjr.dev")),
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Text": {"Data": body}},
        },
    )


def list_attachments_since(cutoff_date: datetime) -> list[str]:
    s3 = boto3.client("s3")

    # List objects
    recent_objects = []
    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(
        Bucket="vargas-jr-inbox",
        Prefix="attachments/",
    ):
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            if obj["LastModified"] >= cutoff_date:
                recent_objects.append(obj["Key"])

    return recent_objects
