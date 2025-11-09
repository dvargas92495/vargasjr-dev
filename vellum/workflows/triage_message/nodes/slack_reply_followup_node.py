import os
from uuid import UUID
from typing import Optional
import requests
from models.outbox_message import OutboxMessage
from models.outbox_message_recipient import OutboxMessageRecipient
from models.types import InboxType, OutboxRecipientType
from vellum.workflows.nodes import BaseNode
from services import get_or_create_contact_id_by_slack_id
from .read_message_node import ReadMessageNode
from .parse_function_call_followup_node import ParseFunctionCallFollowupNode


class SlackReplyFollowupNode(BaseNode):
    channel = ParseFunctionCallFollowupNode.Outputs.parameters["channel"]
    to = ParseFunctionCallFollowupNode.Outputs.parameters["to"]
    message = ParseFunctionCallFollowupNode.Outputs.parameters["message"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]

    class Outputs(BaseNode.Outputs):
        summary: str
        outbox_message: Optional[OutboxMessage] = None
        recipients: list[OutboxMessageRecipient] = []

    def run(self) -> BaseNode.Outputs:
        requests.post(
            "https://slack.com/api/chat.postMessage",
            headers={
                "Authorization": f"Bearer {os.environ['SLACK_BOT_TOKEN']}",
                "Content-Type": "application/json",
            },
            json={
                "channel": f"#{self.channel}",
                "text": f"<@{self.to}> {self.message}",
            },
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
            summary=f"Sent Slack message to @{self.to} in #{self.channel}.",
            outbox_message=outbox_message,
            recipients=recipients,
        )
