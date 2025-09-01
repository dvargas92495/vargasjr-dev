from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode


class NoActionNode(BaseNode):
    message = ReadMessageNode.Outputs.message

    class Outputs(BaseNode.Outputs):
        summary = "No action taken."
        message_url: str

    def run(self) -> BaseNode.Outputs:
        message_url = f"/admin/inboxes/{self.message['inbox_id']}/messages/{self.message['message_id']}"
        return self.Outputs(summary="No action taken.", message_url=message_url)
