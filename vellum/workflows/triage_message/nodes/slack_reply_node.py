import os
import requests
from uuid import UUID
from typing import Optional
from models.outbox_message import OutboxMessage
from models.outbox_message_recipient import OutboxMessageRecipient
from models.types import InboxType, OutboxRecipientType
from services import get_or_create_contact_id_by_slack_id
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


def slack_reply(
    channel: str,
    to: str,
    message: str,
):
    """
    Reply to the message by sending a Slack message to the sender. Because this is Slack,
    the message should be somewhat informal. You do not need to say things like "I've received
    your message" because that is implicit in your reply.
    """
    requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": f"Bearer {os.environ['SLACK_BOT_TOKEN']}",
            "Content-Type": "application/json",
        },
        json={
            "channel": f"#{channel}",
            "text": f"<@{to}> {message}",
        },
    )


class SlackReplyNode(BaseNode):
    to = ReadMessageNode.Outputs.message["source"]
    channel = ReadMessageNode.Outputs.message["inbox_name"]
    message = ParseFunctionCallNode.Outputs.parameters["message"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: Optional[OutboxMessage] = None
        recipients: list[OutboxMessageRecipient] = []

    def run(self) -> BaseNode.Outputs:
        slack_reply(
            channel=self.channel,
            message=self.message,
            to=self.to,
        )
        
        to_contact_id = get_or_create_contact_id_by_slack_id(self.to)
        
        outbox_message = OutboxMessage(
            parent_inbox_message_id=self.inbox_message_id,
            body=self.message,
            type=InboxType.SLACK,
            thread_id=self.thread_id,
        )

        recipients = [
            OutboxMessageRecipient(
                message_id=outbox_message.id,
                contact_id=to_contact_id,
                type=OutboxRecipientType.TO,
            ),
        ]
        
        return self.Outputs(
            summary=f"Sent Slack reply to {self.to} at #{self.channel}.",
            outbox_message=outbox_message,
            recipients=recipients,
        )
