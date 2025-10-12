from typing import Optional
from uuid import UUID
from models.contact import Contact
from models.types import InboxType
from services import get_contact_by_id
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode


class UpdateCRMNode(BaseNode):
    channel = ReadMessageNode.Outputs.message["channel"]
    contact_id = ReadMessageNode.Outputs.message["contact_id"]

    class Outputs(BaseNode.Outputs):
        contact: Contact

    def run(self) -> BaseNode.Outputs:
        contact = get_contact_by_id(self.contact_id)
        return self.Outputs(contact=contact)
