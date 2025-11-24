from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .process_job_node import ProcessJobNode


class ParseJobFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        start_job = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("start_job")))  # type: ignore
        complete_job = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("complete_job")))  # type: ignore
        mark_job_as_blocked = Port.on_if(LazyReference(lambda: ParseJobFunctionCallNode.Outputs.action.equals("mark_job_as_blocked")))  # type: ignore

    class Outputs(BaseNode.Outputs):
        action = ProcessJobNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = ProcessJobNode.Outputs.results[0]["value"]["arguments"]  # type: ignore

    def run(self) -> BaseNode.Outputs:
        return self.Outputs()
