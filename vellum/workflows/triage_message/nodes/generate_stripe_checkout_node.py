import logging
from typing import Dict, Any
from vellum.workflows.nodes import BaseNode
from services import ActionRecord
from services.stripe_service import generate_stripe_checkout_session
from .read_message_node import ReadMessageNode

logger = logging.getLogger(__name__)


class GenerateStripeCheckoutNode(BaseNode):
    contact_email = ReadMessageNode.Outputs.message["contact_email"]
    contact_full_name = ReadMessageNode.Outputs.message["contact_full_name"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
        checkout_url: str
    
    def run(self) -> Outputs:
        try:
            result = generate_stripe_checkout_session(
                contact_email=self.contact_email,
                contact_full_name=self.contact_full_name,
            )
            
            checkout_url = result["url"]
            session_id = result["session_id"]
            
            summary = f"Successfully generated Stripe checkout session (ID: {session_id}). Checkout URL: {checkout_url}"
            
            args = {
                "contact_email": self.contact_email,
                "contact_full_name": self.contact_full_name,
            }
            self._append_action_history("generate_stripe_checkout", args, summary)
            
            return self.Outputs(summary=summary, checkout_url=checkout_url)
            
        except Exception as e:
            logger.exception(f"Error generating Stripe checkout: {str(e)}")
            error_message = f"Error generating Stripe checkout: {str(e)}"
            
            args = {
                "contact_email": self.contact_email,
                "contact_full_name": self.contact_full_name,
            }
            self._append_action_history("generate_stripe_checkout", args, error_message)
            
            return self.Outputs(summary=error_message, checkout_url="")
    
    def _append_action_history(self, name: str, args: Dict[str, Any], result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
