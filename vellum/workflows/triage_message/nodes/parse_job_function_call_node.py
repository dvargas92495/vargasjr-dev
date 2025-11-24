from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from .process_job_node import ProcessJobNode


class ParseJobFunctionCallNode(BaseNode):
    results = ProcessJobNode.Outputs.results

    class Ports(BaseNode.Ports):
        get_job_context = Port.on_if(results[0]["value"]["name"].equals("get_job_context"))
        complete_job = Port.on_if(results[0]["value"]["name"].equals("complete_job"))
        defer_job = Port.on_if(results[0]["value"]["name"].equals("defer_job"))

    def run(self) -> BaseNode.Outputs:
        return self.Outputs()
