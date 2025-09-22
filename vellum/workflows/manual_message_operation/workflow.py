from vellum.workflows import BaseWorkflow
from .nodes import ManualOperationNode


class ManualMessageOperationWorkflow(BaseWorkflow):
    graph = {
        ManualOperationNode,
    }

    class Outputs(BaseWorkflow.Outputs):
        success = ManualOperationNode.Outputs.success
        message = ManualOperationNode.Outputs.message
