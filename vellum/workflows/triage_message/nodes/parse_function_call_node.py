from vellum.workflows.nodes import BaseNode
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .triage_message_node import TriageMessageNode


def _is_function_call(name: str) -> LazyReference:
    return (
        LazyReference(lambda: TriageMessageNode.Outputs.results[0]["type"].equals("FUNCTION_CALL"))  # type: ignore
        & LazyReference(lambda n=name: TriageMessageNode.Outputs.results[0]["value"]["name"].equals(n))  # type: ignore
    )


class ParseFunctionCallNode(BaseNode):
    class Ports(BaseNode.Ports):
        retry = Port.on_if(
            LazyReference(lambda: TriageMessageNode.Outputs.results[0]["type"].does_not_equal("FUNCTION_CALL"))  # type: ignore
        )
        no_action = Port.on_if(_is_function_call("no_action"))
        get_message_history = Port.on_if(_is_function_call("get_message_history"))
        lookup_url = Port.on_if(_is_function_call("lookup_url"))
        email_reply = Port.on_if(_is_function_call("email_reply"))
        email_initiate = Port.on_if(_is_function_call("email_initiate"))
        text_reply = Port.on_if(_is_function_call("text_reply"))
        slack_reply = Port.on_if(_is_function_call("slack_reply"))
        job_opportunity_response = Port.on_if(_is_function_call("job_opportunity_response"))
        create_meeting = Port.on_if(_is_function_call("create_meeting"))
        mark_contact_as_lead = Port.on_if(_is_function_call("mark_contact_as_lead"))
        start_demo = Port.on_if(_is_function_call("start_demo"))
        generate_stripe_checkout = Port.on_if(_is_function_call("generate_stripe_checkout"))

    class Outputs(BaseNode.Outputs):
        action = TriageMessageNode.Outputs.results[0]["value"]["name"]  # type: ignore
        parameters = TriageMessageNode.Outputs.results[0]["value"]["arguments"]  # type: ignore
