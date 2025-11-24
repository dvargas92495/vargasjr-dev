from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .process_job_node import ProcessJobNode


class ParseJobFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        get_job_context = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("get_job_context")))  # type: ignore
        complete_job = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("complete_job")))  # type: ignore
        defer_job = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("defer_job")))  # type: ignore

    class Outputs(BaseNode.Outputs):
        action = ProcessJobNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = ProcessJobNode.Outputs.results[0]["value"]["arguments"]  # type: ignore

    def run(self) -> BaseNode.Outputs:
        return self.Outputs()
