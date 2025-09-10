from vellum.workflows.nodes import BaseNode
from services.gmail import get_emails_from_last_day
from typing import List, Dict, Any


class FetchEmailsNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        emails: List[Dict[str, Any]]
        emails_count: int

    def run(self) -> Outputs:
        emails = get_emails_from_last_day()
        
        return self.Outputs(
            emails=emails,
            emails_count=len(emails)
        )
