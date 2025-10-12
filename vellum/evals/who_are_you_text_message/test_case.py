#!/usr/bin/env python3

import asyncio
from typing import List, Dict, Any
from evals.base import BaseEval


class WhoAreYouTextMessageEval(BaseEval):
    """
    Evaluation setup for testing "who are you" text message workflows.
    This class outlines the steps needed to set up comprehensive evaluations
    for identity question handling in the triage message workflow.
    """
    
    name = "who_are_you_text_message"
    description = "Evaluation for 'who are you' text message handling"
    test_cases = [
        {
            "id": "direct-who-are-you",
            "message": "who are you",
            "type": "direct_question",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "capitalized-who-are-you",
            "message": "Who are you?",
            "type": "direct_question_capitalized",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "what-do-you-do",
            "message": "what do you do",
            "type": "service_inquiry",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "tell-me-about-yourself",
            "message": "tell me about yourself",
            "type": "introduction_request",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "who-am-i-talking-to",
            "message": "who am I talking to",
            "type": "contact_identification",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "what-service-is-this",
            "message": "what service is this",
            "type": "service_identification",
            "expected_trigger": "text_reply",
            "case_sensitive": False,
            "metrics": [
                {
                    "type": "regex_match",
                    "output_name": "message_url",
                    "target_expression": "^/admin/inboxes/\\d+/messages/\\d+$",
                    "weight": 3
                },
                {
                    "type": "regex_match",
                    "output_name": "summary",
                    "target_expression": "^Sent text message to .+\\.$",
                    "weight": 3
                }
            ]
        }
    ]
    
    def get_setup_steps(self) -> List[Dict[str, Any]]:
        """
        Returns a list of setup steps required for "who are you" text message evaluation.
        Each step contains the action, description, and expected outcome.
        """
        return [
            {
                "step": 1,
                "action": "setup_test_phone_numbers",
                "description": "Configure test phone numbers for unknown contacts",
                "details": [
                    "Set up multiple test phone numbers not in contact database",
                    "Configure Twilio webhook endpoints for test environment",
                    "Verify phone number formatting and validation",
                    "Set up rate limiting for test scenarios",
                    "Configure SMS delivery tracking"
                ],
                "expected_outcome": "Test phone numbers ready for unknown contact simulation"
            },
            {
                "step": 2,
                "action": "prepare_identity_question_variations",
                "description": "Create various forms of identity questions to test",
                "details": [
                    "Direct questions: 'who are you', 'what are you', 'who is this'",
                    "Casual variations: 'who am I talking to', 'what do you do'",
                    "Formal inquiries: 'could you introduce yourself', 'tell me about yourself'",
                    "Context-specific: 'what service is this', 'what company is this'",
                    "Mixed case and punctuation variations"
                ],
                "expected_outcome": "Comprehensive set of identity question test cases"
            },
            {
                "step": 3,
                "action": "configure_triage_workflow_testing",
                "description": "Set up triage message workflow for identity question testing",
                "details": [
                    "Configure Vellum workflow deployment for testing",
                    "Set up workflow execution monitoring",
                    "Configure function call parsing validation",
                    "Set up response message tracking",
                    "Configure error handling and fallback scenarios"
                ],
                "expected_outcome": "Triage workflow ready for identity question testing"
            },
            {
                "step": 4,
                "action": "setup_response_validation",
                "description": "Configure validation for VargasJR identity responses",
                "details": [
                    "Validate response contains 'Vargas JR' name",
                    "Check for 'automated senior-level software developer' description",
                    "Verify 'available for hire' messaging",
                    "Confirm professional and helpful tone",
                    "Validate response length and formatting"
                ],
                "expected_outcome": "Response validation criteria established"
            },
            {
                "step": 5,
                "action": "create_test_scenarios",
                "description": "Develop specific test scenarios for evaluation",
                "details": [
                    "Scenario 1: Unknown number asks 'who are you'",
                    "Scenario 2: Casual inquiry 'what do you do'",
                    "Scenario 3: Formal introduction request",
                    "Scenario 4: Service identification question",
                    "Scenario 5: Mixed case and punctuation variations",
                    "Scenario 6: Follow-up questions after introduction"
                ],
                "expected_outcome": "Complete test scenario coverage for identity questions"
            },
            {
                "step": 6,
                "action": "setup_workflow_execution_monitoring",
                "description": "Configure monitoring for workflow execution paths",
                "details": [
                    "Track function call selection accuracy",
                    "Monitor who_are_you function triggering",
                    "Validate ParseFunctionCallNode routing",
                    "Track WhoAreYouNode execution",
                    "Monitor outbox message creation",
                    "Validate SMS delivery confirmation"
                ],
                "expected_outcome": "Comprehensive workflow execution monitoring"
            },
            {
                "step": 7,
                "action": "validate_integration_points",
                "description": "Test all integration points for identity responses",
                "details": [
                    "Verify Twilio webhook processing",
                    "Test contact creation for unknown numbers",
                    "Validate inbox message storage",
                    "Check triage workflow triggering",
                    "Confirm outbox message processing",
                    "Verify SMS response delivery"
                ],
                "expected_outcome": "All integration points validated for identity responses"
            },
            {
                "step": 8,
                "action": "setup_edge_case_testing",
                "description": "Configure testing for edge cases and error scenarios",
                "details": [
                    "Test with malformed phone numbers",
                    "Handle SMS delivery failures",
                    "Test workflow timeout scenarios",
                    "Validate error message handling",
                    "Test rate limiting behavior",
                    "Handle duplicate message scenarios"
                ],
                "expected_outcome": "Edge case and error scenario testing ready"
            }
        ]
