from services import postgres_session
from vellum.workflows.nodes import BaseNode
from .email_reply_node import EmailReplyNode
from .email_initiate_node import EmailInitiateNode
from .text_reply_node import TextReplyNode
from .slack_reply_node import SlackReplyNode


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

    def run(self) -> BaseNode.Outputs:
        with postgres_session() as session:
            session.add(self.outbox_message)
            session.commit()
        return self.Outputs(summary=self.summary)
