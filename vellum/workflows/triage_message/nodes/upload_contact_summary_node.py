import os
from vellum.workflows.nodes import BaseNode
from services.aws import get_aws_session
from .fetch_contact_summary_node import FetchContactSummaryNode
from .update_contact_summary_node import UpdateContactSummaryNode


class UploadContactSummaryNode(BaseNode):
    contact_id = FetchContactSummaryNode.Outputs.contact_id
    updated_summary = UpdateContactSummaryNode.Outputs.text

    class Outputs(BaseNode.Outputs):
        success: bool

    def run(self) -> Outputs:
        try:
            session = get_aws_session()
            s3_client = session.client("s3")
            bucket_name = "vargas-jr-memory"
            
            if os.getenv("VERCEL_ENV") == "production":
                key = f"contacts/{self.contact_id}/summary.txt"
            else:
                preview_id = os.getenv("VERCEL_GIT_COMMIT_SHA", "preview")
                key = f"previews/{preview_id}/contacts/{self.contact_id}/summary.txt"
            
            s3_client.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=self.updated_summary.encode("utf-8"),
                ContentType="text/plain",
            )
            
            del s3_client
            del session
            
            return self.Outputs(success=True)
        except Exception as e:
            print(f"Failed to upload contact summary to S3: {e}")
            return self.Outputs(success=False)
