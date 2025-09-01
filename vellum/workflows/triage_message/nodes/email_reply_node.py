from .send_email_node import SendEmailNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class EmailReplyNode(SendEmailNode):
    to = ReadMessageNode.Outputs.message["source"]
    subject = "RE: "
    body = ParseFunctionCallNode.Outputs.parameters["body"]
    inbox_message_id = ReadMessageNode.Outputs.message["message_id"]
    thread_id = ReadMessageNode.Outputs.message["thread_id"]
