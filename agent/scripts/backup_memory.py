import os
import boto3

from src.services import MEMORY_DIR


def backup_memory():
    if not MEMORY_DIR.exists():
        print("No memory directory found")
        return

    s3_client = boto3.client("s3")
    bucket_name = "vargas-jr-memory"

    # Walk through all files in MEMORY_DIR
    for root, dirs, files in os.walk(MEMORY_DIR):
        for file in files:
            local_path = os.path.join(root, file)
            # Create S3 key by getting relative path from MEMORY_DIR
            s3_key = os.path.relpath(local_path, start=MEMORY_DIR)

            print(f"Uploading {local_path} to s3://{bucket_name}/{s3_key}")
            try:
                s3_client.upload_file(local_path, bucket_name, s3_key)
            except Exception as e:
                print(f"Failed to upload {local_path}: {str(e)}")


if __name__ == "__main__":
    backup_memory()
