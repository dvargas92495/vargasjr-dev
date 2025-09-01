from vellum.workflows.nodes import BaseNode
from vellum.workflows.references import LazyReference
from .read_message_node import ReadMessageNode


class NoActionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary = "No action taken."
        message_url = LazyReference(lambda: f"/admin/inboxes/{ReadMessageNode.Outputs.message['inbox_id']}/messages/{ReadMessageNode.Outputs.message['message_id']}")
