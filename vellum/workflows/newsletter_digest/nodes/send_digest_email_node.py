from vellum.workflows.nodes import BaseNode
from services.gmail import send_email
from .summarize_newsletters_node import SummarizeNewslettersNode
from models.types import USER
import re
from datetime import datetime


class SendDigestEmailNode(BaseNode):
    digest_content = SummarizeNewslettersNode.Outputs.digest_content

    class Outputs(BaseNode.Outputs):
        summary: str
        email_sent: bool

    def run(self) -> Outputs:
        subject_match = re.search(r'Subject:\s*(.+)', self.digest_content)
        if subject_match:
            subject = subject_match.group(1).strip()
            content = re.sub(r'Subject:\s*.+\n?', '', self.digest_content)
        else:
            subject = f"Daily Newsletter Digest - {datetime.now().strftime('%B %d, %Y')}"
            content = self.digest_content

        email_sent = send_email(
            to=USER.email,
            subject=subject,
            body=content
        )

        if email_sent:
            summary = f"Successfully sent newsletter digest to {USER.email}"
        else:
            summary = f"Failed to send newsletter digest to {USER.email}"

        return self.Outputs(
            summary=summary,
            email_sent=email_sent
        )
