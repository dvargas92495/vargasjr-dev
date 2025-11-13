from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_node import TriageMessageNode


class ParseFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        no_action = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("no_action")))  # type: ignore
        get_message_history = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("get_message_history"))  # type: ignore
        )
        email_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_reply")))  # type: ignore
        email_initiate = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("email_initiate"))  # type: ignore
        )
        text_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("text_reply")))  # type: ignore
        slack_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("slack_reply")))  # type: ignore
        job_opportunity_response = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("job_opportunity_response"))  # type: ignore
        )
        create_meeting = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("create_meeting"))  # type: ignore
        )

    class Outputs(BaseNode.Outputs):
        action = TriageMessageNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = TriageMessageNode.Outputs.results[0]["value"]["arguments"]  # type: ignore
