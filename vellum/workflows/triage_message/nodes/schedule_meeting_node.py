from typing import Optional
from vellum.workflows.nodes import BaseNode
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode


class MeetingResult(UniversalBaseModel):
    summary: str
    meeting_url: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    provider: Optional[str] = None


class ScheduleMeetingNode(BaseNode):
    scheduling_link = ParseFunctionCallNode.Outputs.parameters["scheduling_link"]
    contact_email = ReadMessageNode.Outputs.message["contact_email"]
    contact_full_name = ReadMessageNode.Outputs.message["contact_full_name"]
    contact_phone_number = ReadMessageNode.Outputs.message["contact_phone_number"]
    
    class Outputs(BaseNode.Outputs):
        meeting_result: MeetingResult
    
    def run(self) -> Outputs:
        
        summary = f"Meeting scheduling requested for link: {self.scheduling_link}"
        
        if self.contact_email:
            summary += f" (Contact: {self.contact_email})"
        
        meeting_result = MeetingResult(
            summary=summary,
            meeting_url=self.scheduling_link,
            starts_at=None,
            ends_at=None,
            provider=self._detect_provider(self.scheduling_link)
        )
        
        return self.Outputs(meeting_result=meeting_result)
    
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
