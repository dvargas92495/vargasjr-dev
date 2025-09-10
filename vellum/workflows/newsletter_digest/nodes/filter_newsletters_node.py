from vellum import ChatMessagePromptBlock, JinjaPromptBlock
from vellum.workflows.nodes import InlinePromptNode, BaseNode
from .fetch_emails_node import FetchEmailsNode
from typing import List, Dict, Any
import json


class FilterNewslettersNode(InlinePromptNode):
    emails = FetchEmailsNode.Outputs.emails
    
    prompt_inputs = {"emails": emails}
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
You are an email classification expert. Your task is to identify which emails are newsletters vs regular personal/business emails.

Newsletter characteristics:
- Sent from companies, publications, or automated systems
- Contains news, updates, promotions, or curated content
- Often has unsubscribe links
- Sender domains like newsletters@, news@, updates@, noreply@
- Subject lines with promotional language, news updates, or regular publication patterns

Regular email characteristics:
- Personal correspondence from individuals
- Business emails from specific people
- Transactional emails (receipts, confirmations)
- Direct replies or conversations

Below is a JSON array of emails. For each email, determine if it's a newsletter (true) or regular email (false).

Return ONLY a JSON array of objects with this format:
[
  {
    "id": "email_id",
    "is_newsletter": true/false,
    "reason": "brief explanation"
  }
]

Emails to classify:
{{ emails | tojson }}"""
                )
            ],
        )
    ]

    class Outputs(BaseNode.Outputs):
        newsletters: List[Dict[str, Any]]
        newsletters_count: int

    def run(self) -> Outputs:
        classification_result = super().run().text
        
        try:
            classifications = json.loads(classification_result)
        except json.JSONDecodeError:
            classifications = []
        
        newsletters = []
        for email in self.emails:
            for classification in classifications:
                if classification.get("id") == email.get("id") and classification.get("is_newsletter"):
                    newsletters.append(email)
                    break
        
        return self.Outputs(
            newsletters=newsletters,
            newsletters_count=len(newsletters)
        )
