import os
from typing import Optional
from vellum.workflows.nodes import BaseNode
from services.aws import get_aws_session
from .read_message_node import ReadMessageNode


class FetchContactSummaryNode(BaseNode):
    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        current_summary: Optional[str]
        contact_id: str

    def run(self) -> Outputs:
        contact_id = str(self.message.contact_id)
        
        try:
            session = get_aws_session()
            s3_client = session.client("s3")
            bucket_name = "vargas-jr-memory"
            
            if os.getenv("VERCEL_ENV") == "production":
                key = f"contacts/{contact_id}/summary.txt"
            else:
                preview_id = os.getenv("VERCEL_GIT_COMMIT_SHA", "preview")
                key = f"previews/{preview_id}/contacts/{contact_id}/summary.txt"
            
            response = s3_client.get_object(Bucket=bucket_name, Key=key)
            current_summary = response["Body"].read().decode("utf-8")
            
            del s3_client
            del session
            
            return self.Outputs(
                current_summary=current_summary,
                contact_id=contact_id
            )
        except Exception as e:
            return self.Outputs(
                current_summary=None,
                contact_id=contact_id
            )
