import logging
from vellum.workflows.nodes import BaseNode
from services import postgres_session, ActionRecord
from models.contact import Contact
from models.types import ContactStatus
from .read_message_node import ReadMessageNode
from sqlmodel import select

logger = logging.getLogger(__name__)


class MarkContactAsLeadNode(BaseNode):
    contact_id = ReadMessageNode.Outputs.message["contact_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            with postgres_session() as session:
                statement = select(Contact).where(Contact.id == self.contact_id)
                contact = session.exec(statement).first()
                
                if not contact:
                    result = f"Contact not found with ID: {self.contact_id}"
                    self._append_action_history("mark_contact_as_lead", {}, result)
                    return self.Outputs(summary=result)
                
                contact.status = ContactStatus.LEAD
                session.add(contact)
                session.commit()
                
                result = f"Successfully marked contact {contact.identifier} as LEAD"
                self._append_action_history("mark_contact_as_lead", {}, result)
                return self.Outputs(summary=result)
                
        except Exception as e:
            logger.exception(f"Error marking contact as lead: {str(e)}")
            result = f"Error marking contact as lead: {str(e)}"
            self._append_action_history("mark_contact_as_lead", {}, result)
            return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: dict, result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
