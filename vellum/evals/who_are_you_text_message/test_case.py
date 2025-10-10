#!/usr/bin/env python3

import asyncio
from typing import List, Dict, Any
from vellum.evals.base import BaseEval


class WhoAreYouTextMessageEval(BaseEval):
    """
    Evaluation setup for testing "who are you" text message workflows.
    This class outlines the steps needed to set up comprehensive evaluations
    for identity question handling in the triage message workflow.
    """
    
    def __init__(self):
        self.eval_name = "who_are_you_text_message"
        self.description = "Evaluation for 'who are you' text message handling"
    
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
    
    def get_test_data(self) -> Dict[str, Any]:
        """
        Returns sample test data for "who are you" text message evaluation.
        """
        return {
            "identity_questions": [
                {
                    "message": "who are you",
                    "type": "direct_question",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                },
                {
                    "message": "Who are you?",
                    "type": "direct_question_capitalized",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                },
                {
                    "message": "what do you do",
                    "type": "service_inquiry",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                },
                {
                    "message": "tell me about yourself",
                    "type": "introduction_request",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                },
                {
                    "message": "who am I talking to",
                    "type": "contact_identification",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                },
                {
                    "message": "what service is this",
                    "type": "service_identification",
                    "expected_trigger": "text_reply",
                    "case_sensitive": False
                }
            ],
            "test_phone_numbers": [
                "+15551234567",
                "+15559876543",
                "+15555555555"
            ],
            "expected_response_elements": [
                "Vargas JR",
                "automated senior-level software developer",
                "available for hire",
                "fraction of the cost",
                "How can I assist you"
            ],
            "workflow_validation_points": [
                "triage_message_function_selection",
                "text_reply_function_call",
                "parse_function_call_routing",
                "text_reply_node_execution",
                "outbox_message_creation",
                "sms_response_delivery"
            ]
        }


async def main():
    """
    Main function to demonstrate the "who are you" text message evaluation setup.
    """
    eval_setup = WhoAreYouTextMessageEval()
    
    print(f"=== {eval_setup.description.upper()} ===\n")
    
    setup_steps = eval_setup.get_setup_steps()
    
    print("EVALUATION SETUP STEPS:")
    print("=" * 50)
    
    for step in setup_steps:
        print(f"\nStep {step['step']}: {step['action'].upper()}")
        print(f"Description: {step['description']}")
        print("Details:")
        for detail in step['details']:
            print(f"  • {detail}")
        print(f"Expected Outcome: {step['expected_outcome']}")
        print("-" * 50)
    
    test_data = eval_setup.get_test_data()
    print(f"\nSAMPLE TEST DATA:")
    print("=" * 50)
    print(f"Identity question variations: {len(test_data['identity_questions'])}")
    print(f"Test phone numbers: {len(test_data['test_phone_numbers'])}")
    print(f"Expected response elements: {len(test_data['expected_response_elements'])}")
    print(f"Workflow validation points: {len(test_data['workflow_validation_points'])}")


if __name__ == "__main__":
    asyncio.run(main())
