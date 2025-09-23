from vellum.workflows import BaseWorkflow
from vellum.workflows.state import BaseState
from vellum.workflows.ports import Port
from vellum.workflows.references import LazyReference
from .inputs import Inputs
from .nodes import (
    ReadMessageNode,
    UpdateCRMNode,
    TriageMessageNode,
    ParseFunctionCallNode,
    SendEmailNode,
    NoActionNode,
    EmailReplyNode,
    EmailInitiateNode,
    TextReplyNode,
    SlackReplyNode,
    JobOpportunityResponseNode,
    StoreOutboxMessageNode,
    ManualUnreadNode,
    ManualArchivedNode,
)


class TriageMessageWorkflow(BaseWorkflow[Inputs, BaseState]):
    class Ports(BaseWorkflow.Ports):
        manual_unread = Port.on_if(
            LazyReference(lambda: Inputs.operation.equals("UNREAD"))
        )
        manual_archived = Port.on_if(
            LazyReference(lambda: Inputs.operation.equals("ARCHIVED"))
        )
        automatic = Port.on_else()

    graph = {
        Ports.manual_unread >> ManualUnreadNode,
        Ports.manual_archived >> ManualArchivedNode,
        Ports.automatic >> ReadMessageNode.Ports.no_action >> NoActionNode,
        Ports.automatic >> ReadMessageNode.Ports.triage
        >> UpdateCRMNode
        >> TriageMessageNode
        >> {
            ParseFunctionCallNode.Ports.no_action >> NoActionNode,
            {
                ParseFunctionCallNode.Ports.email_reply >> EmailReplyNode,
                ParseFunctionCallNode.Ports.email_initiate >> EmailInitiateNode,
                ParseFunctionCallNode.Ports.text_reply >> TextReplyNode,
                ParseFunctionCallNode.Ports.slack_reply >> SlackReplyNode,
                ParseFunctionCallNode.Ports.job_opportunity_response >> JobOpportunityResponseNode,
            }
            >> StoreOutboxMessageNode,
        },
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = NoActionNode.Outputs.summary.coalesce(
            StoreOutboxMessageNode.Outputs.summary
        ).coalesce(
            ManualUnreadNode.Outputs.message
        ).coalesce(
            ManualArchivedNode.Outputs.message
        )
        message_url = NoActionNode.Outputs.message_url.coalesce(StoreOutboxMessageNode.Outputs.message_url)
