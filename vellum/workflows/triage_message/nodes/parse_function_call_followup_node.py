from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_followup_node import TriageMessageFollowupNode


class ParseFunctionCallFollowupNode(BaseNode):
    class Ports(BaseNode.Ports):
        email_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallFollowupNode.Outputs.action.equals("email_reply")))  # type: ignore
        email_initiate = Port.on_if(
            LazyReference(lambda: ParseFunctionCallFollowupNode.Outputs.action.equals("email_initiate"))  # type: ignore
        )
        text_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallFollowupNode.Outputs.action.equals("text_reply")))  # type: ignore
        slack_reply = Port.on_if(LazyReference(lambda: ParseFunctionCallFollowupNode.Outputs.action.equals("slack_reply")))  # type: ignore

    class Outputs(BaseNode.Outputs):
        action = TriageMessageFollowupNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = TriageMessageFollowupNode.Outputs.results[0]["value"]["arguments"]  # type: ignore
