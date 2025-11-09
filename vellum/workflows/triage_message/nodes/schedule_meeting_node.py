from vellum.workflows.nodes import BaseNode
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class ScheduleMeetingNode(BaseNode):
    scheduling_link = ParseFunctionCallNode.Outputs.parameters["scheduling_link"]
    contact_email = ReadMessageNode.Outputs.message["contact_email"]
    contact_full_name = ReadMessageNode.Outputs.message["contact_full_name"]
    contact_phone_number = ReadMessageNode.Outputs.message["contact_phone_number"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        
        provider = self._detect_provider(self.scheduling_link)
        
        summary = f"Successfully detected {provider} scheduling link: {self.scheduling_link}"
        
        if self.contact_email:
            summary += f" for contact {self.contact_email}"
        
        return self.Outputs(summary=summary)
    
    def _detect_provider(self, link: str) -> str:
        """Detect the scheduling provider from the link"""
        link_lower = link.lower()
        if "cal.com" in link_lower:
            return "Cal.com"
        elif "calendly.com" in link_lower:
            return "Calendly"
        elif "reclaim.ai" in link_lower:
            return "Reclaim"
        elif "motion.com" in link_lower:
            return "Motion"
        else:
            return "Unknown"
