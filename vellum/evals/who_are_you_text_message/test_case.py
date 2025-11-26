#!/usr/bin/env python3

from typing import List, Dict, Any
from evals.base import BaseEval
from evals.metrics import RegexMatchMetric


class WhoAreYouTextMessageEval(BaseEval):
    """
    Evaluation for testing "who are you" text message workflows.
    Tests identity question handling in the triage message workflow.
    """
    
    name = "who_are_you_text_message"
    description = "Evaluation for 'who are you' text message handling"
    
    id = "direct-who-are-you"
    message = "who are you"
    type = "direct_question"
    expected_trigger = "text_reply"
    case_sensitive = False
    metrics = [
        RegexMatchMetric(
            output_name="message_url",
            target_expression=r"^/admin/messages/inbox/[0-9a-f-]+$",
            weight=3
        ),
        RegexMatchMetric(
            output_name="summary",
            target_expression=r"^Sent text message to .+\.$",
            weight=3
        )
    ]
    
    def get_setup_steps(self) -> List[Dict[str, Any]]:
        """
        Returns a list of setup steps required for "who are you" text message evaluation.
        These are declarative steps that the eval runner knows how to execute.
        """
        return [
            {
                "action": "create_inbox",
                "params": {
                    "name": "eval-sms-inbox",
                    "type": "sms",
                    "display_label": "Eval SMS Inbox"
                }
            },
            {
                "action": "create_contact",
                "params": {
                    "phone_number": "+15555551234",
                    "full_name": "Test Contact"
                }
            },
            {
                "action": "create_inbox_message",
                "params": {
                    "inbox_name": "eval-sms-inbox",
                    "body": "who are you",
                    "phone_number": "+15555551234"
                }
            }
        ]
