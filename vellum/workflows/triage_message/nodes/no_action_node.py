from vellum.workflows.nodes import BaseNode


class NoActionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary = "No action taken."
