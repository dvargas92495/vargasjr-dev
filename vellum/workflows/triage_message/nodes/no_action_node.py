from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode


class NoActionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary = "No action taken."
        message_url: str

    def run(self) -> BaseNode.Outputs:
        message = ReadMessageNode.Outputs.message
        message_url = f"/admin/inboxes/{message['inbox_id']}/messages/{message['message_id']}"
        return self.Outputs(summary="No action taken.", message_url=message_url)
