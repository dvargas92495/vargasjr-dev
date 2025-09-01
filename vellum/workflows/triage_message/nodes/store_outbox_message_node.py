from services import postgres_session
from vellum.workflows.nodes import BaseNode
from .email_reply_node import EmailReplyNode
from .email_initiate_node import EmailInitiateNode
from .text_reply_node import TextReplyNode
from .slack_reply_node import SlackReplyNode
from .read_message_node import ReadMessageNode


class StoreOutboxMessageNode(BaseNode):
    summary = (
        EmailReplyNode.Outputs.summary.coalesce(EmailInitiateNode.Outputs.summary)
        .coalesce(TextReplyNode.Outputs.summary)
        .coalesce(SlackReplyNode.Outputs.summary)
    )

    outbox_message = (
        EmailReplyNode.Outputs.outbox_message.coalesce(EmailInitiateNode.Outputs.outbox_message)
        .coalesce(TextReplyNode.Outputs.outbox_message)
        .coalesce(SlackReplyNode.Outputs.outbox_message)
    )

    class Outputs(BaseNode.Outputs):
        summary: str
        message_url: str

    def run(self) -> BaseNode.Outputs:
        with postgres_session() as session:
            session.add(self.outbox_message)
            session.commit()
        
        message = ReadMessageNode.Outputs.message
        message_url = f"/admin/inboxes/{message['inbox_id']}/messages/{message['message_id']}"
        return self.Outputs(summary=self.summary, message_url=message_url)
