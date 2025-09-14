from .send_email_node import SendEmailNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class JobOpportunityForwarderConfirmationNode(SendEmailNode):
    to = ReadMessageNode.Outputs.message["contact_email"]
    subject = "Confirmation: Responded to Job Opportunity"
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]

    body = ParseFunctionCallNode.Outputs.parameters["body"]
