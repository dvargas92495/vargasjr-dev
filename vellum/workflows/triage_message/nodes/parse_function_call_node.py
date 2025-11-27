from typing import Any
from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_node import TriageMessageNode


class ParseFunctionCallNode(BaseNode):
    result = TriageMessageNode.Outputs.results[0]

    class Ports(BaseNode.Ports):
        no_action = Port.on_if(LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("no_action")))  # type: ignore
        get_message_history = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("get_message_history"))  # type: ignore
        )
        lookup_url = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("lookup_url"))  # type: ignore
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
        mark_contact_as_lead = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("mark_contact_as_lead"))  # type: ignore
        )
        start_demo = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("start_demo"))  # type: ignore
        )
        generate_stripe_checkout = Port.on_if(
            LazyReference(lambda: ParseFunctionCallNode.Outputs.action.equals("generate_stripe_checkout"))  # type: ignore
        )

    class Outputs(BaseNode.Outputs):
        action: str
        parameters: dict[str, Any]

    def run(self) -> Outputs:
        result = self.result

        if not result or "type" not in result:
            return self.Outputs(action="no_action", parameters={})

        if result["type"] == "FUNCTION_CALL":
            value = result.get("value") or {}
            return self.Outputs(
                action=value.get("name", "no_action"),
                parameters=value.get("arguments") or {},
            )

        value = result.get("value")
        if isinstance(value, str) and value:
            action = value
        else:
            action = "no_action"

        return self.Outputs(action=action, parameters={})
