from vellum.workflows.nodes import BaseNode
from services.aws import get_aws_session, generate_s3_key
from services.constants import S3_MEMORY_BUCKET
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
            bucket_name = S3_MEMORY_BUCKET
            
            base_key = f"contacts/{self.contact_id}/summary.txt"
            key = generate_s3_key(base_key)
            
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
