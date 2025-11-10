import logging
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from vellum.workflows.nodes import BaseNode
from services import get_application_by_name, ActionRecord
from .read_message_node import ReadMessageNode
from .parse_function_call_node import ParseFunctionCallNode

logger = logging.getLogger(__name__)


class ScheduleMeetingNode(BaseNode):
    scheduling_link = ParseFunctionCallNode.Outputs.parameters["scheduling_link"]
    contact_email = ReadMessageNode.Outputs.message["contact_email"]
    contact_full_name = ReadMessageNode.Outputs.message["contact_full_name"]
    contact_phone_number = ReadMessageNode.Outputs.message["contact_phone_number"]
    
    class Outputs(BaseNode.Outputs):
        summary: str
    
    def run(self) -> Outputs:
        provider = self._detect_provider(self.scheduling_link)
        
        args = {
            "scheduling_link": self.scheduling_link,
            "contact_email": self.contact_email,
            "contact_full_name": self.contact_full_name,
        }
        
        if provider == "Cal.com":
            result = self._schedule_calcom()
        elif provider == "Calendly":
            result = self._schedule_calendly()
        else:
            result = f"Unsupported scheduling provider: {provider}"
            self._append_action_history("create_meeting", args, result)
            return self.Outputs(summary=result)
        
        self._append_action_history("create_meeting", args, result)
        return self.Outputs(summary=result)
    
    def _detect_provider(self, link: str) -> str:
        """Detect the scheduling provider from the link"""
        link_lower = link.lower()
        if "cal.com" in link_lower:
            return "Cal.com"
        elif "calendly.com" in link_lower:
            return "Calendly"
        else:
            return "Unknown"
    
    def _append_action_history(self, name: str, args: Dict[str, Any], result: str) -> None:
        """Append an action record to the workflow state"""
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, 'action_history'):
            self.state.action_history = []
        self.state.action_history.append(action_record)
    
    def _schedule_calcom(self) -> str:
        """Schedule a meeting using Cal.com API"""
        try:
            app = get_application_by_name("Cal.com")
            if not app or not app.client_secret:
                return "Cal.com API key not found in applications table"
            
            link_parts = self.scheduling_link.rstrip('/').split('/')
            if len(link_parts) < 2:
                return f"Invalid Cal.com link format: {self.scheduling_link}"
            
            event_type_slug = link_parts[-1]
            username = link_parts[-2] if len(link_parts) >= 2 else None
            
            headers = {
                "Authorization": f"Bearer {app.client_secret}",
                "Content-Type": "application/json",
            }
            
            event_types_response = requests.get(
                "https://api.cal.com/v2/event-types",
                headers=headers,
                timeout=10
            )
            
            if event_types_response.status_code != 200:
                logger.error(f"Cal.com event types API error: {event_types_response.status_code} - {event_types_response.text}")
                return f"Failed to fetch Cal.com event types: {event_types_response.status_code}"
            
            event_types = event_types_response.json().get("data", {}).get("eventTypes", [])
            matching_event = None
            for et in event_types:
                if et.get("slug") == event_type_slug:
                    matching_event = et
                    break
            
            if not matching_event:
                return f"Event type '{event_type_slug}' not found in Cal.com account"
            
            event_type_id = matching_event.get("id")
            
            start_date = datetime.now()
            end_date = start_date + timedelta(days=14)
            
            slots_response = requests.get(
                f"https://api.cal.com/v2/slots/available",
                headers=headers,
                params={
                    "eventTypeId": event_type_id,
                    "startTime": start_date.isoformat(),
                    "endTime": end_date.isoformat(),
                },
                timeout=10
            )
            
            if slots_response.status_code != 200:
                logger.error(f"Cal.com slots API error: {slots_response.status_code} - {slots_response.text}")
                return f"Failed to fetch available slots: {slots_response.status_code}"
            
            slots_data = slots_response.json().get("data", {}).get("slots", {})
            
            earliest_slot = None
            for date_str, time_slots in sorted(slots_data.items()):
                if time_slots and len(time_slots) > 0:
                    earliest_slot = time_slots[0].get("time")
                    break
            
            if not earliest_slot:
                return "No available slots found in the next 14 days"
            
            if not self.contact_email:
                return f"Cannot book meeting: contact email is required but not available"
            
            booking_data = {
                "eventTypeId": event_type_id,
                "start": earliest_slot,
                "attendee": {
                    "name": self.contact_full_name or self.contact_email,
                    "email": self.contact_email,
                    "timeZone": "America/New_York",  # Default timezone
                },
                "meetingUrl": self.scheduling_link,
            }
            
            booking_response = requests.post(
                "https://api.cal.com/v2/bookings",
                headers=headers,
                json=booking_data,
                timeout=10
            )
            
            if booking_response.status_code not in [200, 201]:
                logger.error(f"Cal.com booking API error: {booking_response.status_code} - {booking_response.text}")
                return f"Failed to book meeting: {booking_response.status_code}"
            
            booking_result = booking_response.json()
            booking_id = booking_result.get("data", {}).get("id")
            
            return f"Successfully booked Cal.com meeting (ID: {booking_id}) at {earliest_slot} for {self.contact_email}"
            
        except requests.exceptions.Timeout:
            logger.exception("Cal.com API timeout")
            return "Cal.com API request timed out"
        except Exception as e:
            logger.exception(f"Error scheduling Cal.com meeting: {str(e)}")
            return f"Error scheduling Cal.com meeting: {str(e)}"
    
    def _schedule_calendly(self) -> str:
        """Schedule a meeting using Calendly API"""
        try:
            app = get_application_by_name("Calendly")
            if not app or not app.client_secret:
                return "Calendly API token not found in applications table"
            
            headers = {
                "Authorization": f"Bearer {app.client_secret}",
                "Content-Type": "application/json",
            }
            
            user_response = requests.get(
                "https://api.calendly.com/users/me",
                headers=headers,
                timeout=10
            )
            
            if user_response.status_code != 200:
                logger.error(f"Calendly user API error: {user_response.status_code} - {user_response.text}")
                return f"Failed to fetch Calendly user info: {user_response.status_code}"
            
            user_data = user_response.json()
            user_uri = user_data.get("resource", {}).get("uri")
            
            link_parts = self.scheduling_link.rstrip('/').split('/')
            if len(link_parts) < 2:
                return f"Invalid Calendly link format: {self.scheduling_link}"
            
            event_type_slug = link_parts[-1]
            
            event_types_response = requests.get(
                "https://api.calendly.com/event_types",
                headers=headers,
                params={"user": user_uri},
                timeout=10
            )
            
            if event_types_response.status_code != 200:
                logger.error(f"Calendly event types API error: {event_types_response.status_code} - {event_types_response.text}")
                return f"Failed to fetch Calendly event types: {event_types_response.status_code}"
            
            event_types = event_types_response.json().get("collection", [])
            matching_event = None
            for et in event_types:
                if event_type_slug in et.get("scheduling_url", ""):
                    matching_event = et
                    break
            
            if not matching_event:
                return f"Event type '{event_type_slug}' not found in Calendly account"
            
            event_type_uri = matching_event.get("uri")
            
            start_time = datetime.now().isoformat()
            end_time = (datetime.now() + timedelta(days=14)).isoformat()
            
            availability_response = requests.get(
                "https://api.calendly.com/event_type_available_times",
                headers=headers,
                params={
                    "event_type": event_type_uri,
                    "start_time": start_time,
                    "end_time": end_time,
                },
                timeout=10
            )
            
            if availability_response.status_code != 200:
                logger.error(f"Calendly availability API error: {availability_response.status_code} - {availability_response.text}")
                return f"Failed to fetch available times: {availability_response.status_code}"
            
            available_times = availability_response.json().get("collection", [])
            
            if not available_times:
                return "No available slots found in the next 14 days"
            
            earliest_slot = available_times[0].get("start_time")
            
            
            return f"Found available Calendly slot at {earliest_slot}, but programmatic booking requires Calendly Enterprise plan. Please use the scheduling link: {self.scheduling_link}"
            
        except requests.exceptions.Timeout:
            logger.exception("Calendly API timeout")
            return "Calendly API request timed out"
        except Exception as e:
            logger.exception(f"Error scheduling Calendly meeting: {str(e)}")
            return f"Error scheduling Calendly meeting: {str(e)}"
