from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_node import TriageMessageNode


def _is_function_call(name: str) -> Port:
    return Port.on_if(
        LazyReference(lambda: TriageMessageNode.Outputs.results[0]["type"].equals("FUNCTION_CALL"))  # type: ignore
        & LazyReference(lambda: TriageMessageNode.Outputs.results[0]["value"]["name"].equals(name))  # type: ignore
    )


class ParseFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        retry = Port.on_if(
            LazyReference(lambda: TriageMessageNode.Outputs.results[0]["type"].does_not_equal("FUNCTION_CALL"))  # type: ignore
        )
        no_action = _is_function_call("no_action")
        get_message_history = _is_function_call("get_message_history")
        lookup_url = _is_function_call("lookup_url")
        email_reply = _is_function_call("email_reply")
        email_initiate = _is_function_call("email_initiate")
        text_reply = _is_function_call("text_reply")
        slack_reply = _is_function_call("slack_reply")
        job_opportunity_response = _is_function_call("job_opportunity_response")
        create_meeting = _is_function_call("create_meeting")
        mark_contact_as_lead = _is_function_call("mark_contact_as_lead")
        start_demo = _is_function_call("start_demo")
        generate_stripe_checkout = _is_function_call("generate_stripe_checkout")

    class Outputs(BaseNode.Outputs):
        action = TriageMessageNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = TriageMessageNode.Outputs.results[0]["value"]["arguments"]  # type: ignore
