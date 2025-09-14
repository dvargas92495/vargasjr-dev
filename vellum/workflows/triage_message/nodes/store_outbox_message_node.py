from services import postgres_session
from vellum.workflows.nodes import BaseNode
from .email_reply_node import EmailReplyNode
from .email_initiate_node import EmailInitiateNode
from .text_reply_node import TextReplyNode
from .slack_reply_node import SlackReplyNode
from .job_opportunity_recruiter_response_node import JobOpportunityRecruiterResponseNode
from .job_opportunity_forwarder_confirmation_node import JobOpportunityForwarderConfirmationNode
from .read_message_node import ReadMessageNode


class StoreOutboxMessageNode(BaseNode):
    summary = (
        EmailReplyNode.Outputs.summary.coalesce(EmailInitiateNode.Outputs.summary)
        .coalesce(TextReplyNode.Outputs.summary)
        .coalesce(SlackReplyNode.Outputs.summary)
        .coalesce(JobOpportunityRecruiterResponseNode.Outputs.summary)
        .coalesce(JobOpportunityForwarderConfirmationNode.Outputs.summary)
    )

    outbox_message = (
        EmailReplyNode.Outputs.outbox_message.coalesce(EmailInitiateNode.Outputs.outbox_message)
        .coalesce(TextReplyNode.Outputs.outbox_message)
        .coalesce(SlackReplyNode.Outputs.outbox_message)
        .coalesce(JobOpportunityRecruiterResponseNode.Outputs.outbox_message)
        .coalesce(JobOpportunityForwarderConfirmationNode.Outputs.outbox_message)
    )

    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        summary: str
        message_url: str

    def run(self) -> BaseNode.Outputs:
        with postgres_session() as session:
            session.add(self.outbox_message)
            session.commit()
        
        message_url = f"/admin/inboxes/{self.message.inbox_id}/messages/{self.message.message_id}"
        return self.Outputs(summary=self.summary, message_url=message_url)
