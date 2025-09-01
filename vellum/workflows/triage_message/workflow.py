from vellum.workflows import BaseWorkflow
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
    StoreOutboxMessageNode,
)


class TriageMessageWorkflow(BaseWorkflow):
    graph = {
        ReadMessageNode.Ports.no_action >> NoActionNode,
        ReadMessageNode.Ports.triage
        >> UpdateCRMNode
        >> TriageMessageNode
        >> {
            ParseFunctionCallNode.Ports.no_action >> NoActionNode,
            {
                ParseFunctionCallNode.Ports.email_reply >> EmailReplyNode,
                ParseFunctionCallNode.Ports.email_initiate >> EmailInitiateNode,
                ParseFunctionCallNode.Ports.text_reply >> TextReplyNode,
                ParseFunctionCallNode.Ports.slack_reply >> SlackReplyNode,
            }
            >> StoreOutboxMessageNode,
        },
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = NoActionNode.Outputs.summary.coalesce(StoreOutboxMessageNode.Outputs.summary)
        message_url = NoActionNode.Outputs.message_url.coalesce(StoreOutboxMessageNode.Outputs.message_url)
