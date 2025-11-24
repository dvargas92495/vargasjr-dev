from vellum.workflows import BaseWorkflow
from vellum.workflows.inputs import BaseInputs
from .state import State
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
    MarkContactAsLeadNode,
    GetMessageHistoryNode,
    StartDemoNode,
    GenerateStripeCheckoutNode,
    ProcessJobNode,
    ParseJobFunctionCallNode,
    GetJobContextNode,
    CompleteJobNode,
    DeferJobNode,
)


class TriageMessageWorkflow(BaseWorkflow[BaseInputs, State]):
    graph = {
        ReadMessageNode.Ports.no_action >> NoActionNode,
        ReadMessageNode.Ports.process_job >> {
            ProcessJobNode
            >> {
                ParseJobFunctionCallNode.Ports.get_job_context >> GetJobContextNode >> ProcessJobNode,
                ParseJobFunctionCallNode.Ports.complete_job >> CompleteJobNode,
                ParseJobFunctionCallNode.Ports.defer_job >> DeferJobNode,
            }
        },
        ReadMessageNode.Ports.triage
        >> {
            TriageMessageNode
            >> {
                ParseFunctionCallNode.Ports.no_action >> NoActionNode,
                ParseFunctionCallNode.Ports.get_message_history >> GetMessageHistoryNode >> TriageMessageNode,
                ParseFunctionCallNode.Ports.create_meeting >> ScheduleMeetingNode >> TriageMessageNode,
                ParseFunctionCallNode.Ports.mark_contact_as_lead >> MarkContactAsLeadNode >> TriageMessageNode,
                ParseFunctionCallNode.Ports.start_demo >> StartDemoNode >> TriageMessageNode,
                ParseFunctionCallNode.Ports.generate_stripe_checkout >> GenerateStripeCheckoutNode >> TriageMessageNode,
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
        summary = NoActionNode.Outputs.summary.coalesce(
            StoreOutboxMessageNode.Outputs.summary
        ).coalesce(
            CompleteJobNode.Outputs.summary
        ).coalesce(
            DeferJobNode.Outputs.summary
        )
        message_url = NoActionNode.Outputs.message_url.coalesce(
            StoreOutboxMessageNode.Outputs.message_url
        ).coalesce(
            CompleteJobNode.Outputs.message_url
        ).coalesce(
            DeferJobNode.Outputs.message_url
        )
