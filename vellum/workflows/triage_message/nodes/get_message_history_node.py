import logging
from typing import Optional, Dict, Any, List, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session
from uuid import UUID
from vellum.workflows.nodes import BaseNode
from services import postgres_session, ActionRecord
from sqlmodel import select
from models.inbox_message import InboxMessage
from models.inbox_message_operation import InboxMessageOperation
from models.types import InboxMessageOperationType
from models.inbox import Inbox
from models.outbox_message import OutboxMessage
from models.outbox_message_recipient import OutboxMessageRecipient
from models.contact import Contact
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode

logger = logging.getLogger(__name__)


class GetMessageHistoryNode(BaseNode):
    parameters = ParseFunctionCallNode.Outputs.parameters
    message_id = ReadMessageNode.Outputs.message["message_id"]
    contact_id = ReadMessageNode.Outputs.message["contact_id"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        try:
            param_message_id = self.parameters.get("message_id")  # type: ignore[attr-defined]
            resolved_message_id = param_message_id if param_message_id else str(self.message_id)
        except (AttributeError, KeyError):
            resolved_message_id = str(self.message_id)
        
        args = {
            "message_id": resolved_message_id,
        }
        
        try:
            result = self._retrieve_message_history(resolved_message_id)
        except Exception as e:
            logger.exception(f"Error retrieving message history: {str(e)}")
            result = f"Error retrieving message history: {str(e)}"
        
        self._append_action_history("get_message_history", args, result)
        return self.Outputs(summary=result)
    
    def _append_action_history(self, name: str, args: Dict[str, Any], result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
    
    def _retrieve_message_history(self, message_id_str: str) -> str:
        """Retrieve the last 5 messages (incoming and outgoing) from the same contact"""
        try:
            message_uuid = UUID(message_id_str)
            
            with postgres_session() as session:
                current_message_stmt = select(InboxMessage).where(InboxMessage.id == message_uuid)
                current_message = session.exec(current_message_stmt).one_or_none()
                
                if not current_message:
                    return f"Message with ID {message_id_str} not found"
                
                current_contact_id = current_message.contact_id
                
                incoming_stmt = (
                    select(InboxMessage, Inbox.name, Contact)
                    .join(Inbox, Inbox.id == InboxMessage.inbox_id)  # type: ignore[arg-type]
                    .join(Contact, Contact.id == InboxMessage.contact_id)  # type: ignore[arg-type]
                    .where(InboxMessage.contact_id == current_contact_id)
                    .where(InboxMessage.id != message_uuid)
                    .order_by(InboxMessage.created_at.desc())  # type: ignore[attr-defined]
                    .limit(5)
                )
                
                incoming_results = session.exec(incoming_stmt).all()
                
                outgoing_stmt = (
                    select(OutboxMessage)
                    .join(OutboxMessageRecipient, OutboxMessageRecipient.message_id == OutboxMessage.id)  # type: ignore[arg-type]
                    .where(OutboxMessageRecipient.contact_id == current_contact_id)
                    .order_by(OutboxMessage.created_at.desc())  # type: ignore[attr-defined]
                    .limit(5)
                )
                
                outgoing_results = session.exec(outgoing_stmt).all()
                
                all_messages = []
                
                for inbox_msg, inbox_name, contact in incoming_results:
                    source = contact.identifier if hasattr(contact, 'identifier') else (
                        contact.full_name or contact.email or contact.phone_number or contact.slack_display_name or "Contact"
                    )
                    all_messages.append({
                        "timestamp": inbox_msg.created_at,
                        "source": source,
                        "channel": inbox_name,
                        "body": inbox_msg.body,
                        "message_id": inbox_msg.id,
                        "is_incoming": True,
                    })
                
                for outbox_msg in outgoing_results:
                    all_messages.append({
                        "timestamp": outbox_msg.created_at,
                        "source": "VargasJR",
                        "channel": str(outbox_msg.type),
                        "body": outbox_msg.body,
                        "message_id": outbox_msg.id,
                        "is_incoming": False,
                    })
                
                all_messages.sort(key=lambda x: x["timestamp"], reverse=True)
                
                last_5 = all_messages[:5]
                
                # Mark any inbox messages in last_5 as read
                inbox_message_ids_to_mark = [
                    msg["message_id"]
                    for msg in last_5
                    if msg.get("is_incoming")
                ]
                if inbox_message_ids_to_mark:
                    self._mark_messages_as_read(session, inbox_message_ids_to_mark)
                
                if not last_5:
                    return "No previous messages found from this contact"
                
                history_lines = []
                for msg in last_5:
                    timestamp = msg["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
                    history_lines.append(f"[{timestamp}] from {msg['source']} via {msg['channel']}: {msg['body']}")
                
                return "\n".join(history_lines)
                
        except ValueError:
            return f"Invalid message ID format: {message_id_str}"
        except Exception as e:
            logger.exception(f"Error in _retrieve_message_history: {str(e)}")
            return f"Error retrieving message history: {str(e)}"
    
    def _mark_messages_as_read(self, session: "Session", inbox_message_ids: List[UUID]) -> None:
        """Mark the given inbox messages as read"""
        if not inbox_message_ids:
            return
        
        execution_id = self.state.meta.span_id
        
        for message_id in inbox_message_ids:
            session.add(
                InboxMessageOperation(
                    inbox_message_id=message_id,
                    operation=InboxMessageOperationType.READ,
                    execution_id=execution_id,
                )
            )
        
        session.commit()
        logger.info(f"Marked {len(inbox_message_ids)} messages as read")
