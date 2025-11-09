from vellum.workflows import BaseWorkflow
from .nodes import (
    ReadMessageNode,
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
    FetchContactSummaryNode,
    UpdateContactSummaryNode,
    UploadContactSummaryNode,
    ScheduleMeetingNode,
)


class TriageMessageWorkflow(BaseWorkflow):
    graph = {
        ReadMessageNode.Ports.no_action >> NoActionNode,
        ReadMessageNode.Ports.triage
        >> {
            TriageMessageNode
            >> {
                ParseFunctionCallNode.Ports.no_action >> NoActionNode,
                ParseFunctionCallNode.Ports.create_meeting >> ScheduleMeetingNode >> TriageMessageNode,
                {
                    ParseFunctionCallNode.Ports.email_reply >> EmailReplyNode,
                    ParseFunctionCallNode.Ports.email_initiate >> EmailInitiateNode,
                    ParseFunctionCallNode.Ports.text_reply >> TextReplyNode,
                    ParseFunctionCallNode.Ports.slack_reply >> SlackReplyNode,
                    ParseFunctionCallNode.Ports.job_opportunity_response >> JobOpportunityResponseNode,
                }
                >> StoreOutboxMessageNode,
            },
            FetchContactSummaryNode >> UpdateContactSummaryNode >> UploadContactSummaryNode,
        },
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = NoActionNode.Outputs.summary.coalesce(StoreOutboxMessageNode.Outputs.summary)
        message_url = NoActionNode.Outputs.message_url.coalesce(StoreOutboxMessageNode.Outputs.message_url)
