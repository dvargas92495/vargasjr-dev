from .send_email_node import SendEmailNode
from .read_message_node import ReadMessageNode
from .parse_function_call_followup_node import ParseFunctionCallFollowupNode


class EmailInitiateFollowupNode(SendEmailNode):
    to = ParseFunctionCallFollowupNode.Outputs.parameters["to"]
    subject = ParseFunctionCallFollowupNode.Outputs.parameters["subject"]
    body = ParseFunctionCallFollowupNode.Outputs.parameters["body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
