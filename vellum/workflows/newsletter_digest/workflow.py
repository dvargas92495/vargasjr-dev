from vellum.workflows import BaseWorkflow
from .nodes import (
    FetchEmailsNode,
    FilterNewslettersNode,
    SummarizeNewslettersNode,
    SendDigestEmailNode,
)


class NewsletterDigestWorkflow(BaseWorkflow):
    graph = {
        FetchEmailsNode
        >> FilterNewslettersNode
        >> SummarizeNewslettersNode
        >> SendDigestEmailNode,
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = SendDigestEmailNode.Outputs.summary
        emails_processed = FetchEmailsNode.Outputs.emails_count
        newsletters_found = FilterNewslettersNode.Outputs.newsletters_count
