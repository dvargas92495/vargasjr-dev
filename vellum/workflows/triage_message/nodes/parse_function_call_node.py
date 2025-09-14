from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_node import TriageMessageNode


class ParseFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        no_action = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("no_action")))
        email_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_reply")))
        email_initiate = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_initiate"))
        )
        text_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("text_reply")))
        slack_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("slack_reply")))
        job_opportunity_recruiter_response = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("job_opportunity_recruiter_response"))
        )
        job_opportunity_forwarder_confirmation = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("job_opportunity_forwarder_confirmation"))
        )

    class Outputs(BaseNode.Outputs):
        action = TriageMessageNode.Outputs.results[0]["value"]["name"]
        parameters = TriageMessageNode.Outputs.results[0]["value"]["arguments"]
