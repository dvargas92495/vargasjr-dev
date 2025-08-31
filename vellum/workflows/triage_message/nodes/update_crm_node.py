from typing import Optional
from models.contact import Contact
from models.types import InboxType
from services import create_contact, get_contact_by_email, get_contact_by_phone_number
from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode


class UpdateCRMNode(BaseNode):
    channel = ReadMessageNode.Outputs.message["channel"]
    source = ReadMessageNode.Outputs.message["source"]

    class Outputs(BaseNode.Outputs):
        contact: Contact

    def run(self) -> BaseNode.Outputs:
        contact: Optional[Contact] = None
        if self.channel == InboxType.EMAIL or self.channel == InboxType.FORM or self.channel == InboxType.SLACK:
            contact = get_contact_by_email(self.source)
        elif self.channel == InboxType.SMS:
            contact = get_contact_by_phone_number(self.source)
        else:
            raise ValueError(f"Unknown channel {self.channel}")

        if not contact:
            contact = create_contact(self.channel, self.source)

        return self.Outputs(contact=contact)
