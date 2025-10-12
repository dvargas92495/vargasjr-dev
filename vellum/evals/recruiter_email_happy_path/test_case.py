#!/usr/bin/env python3

import asyncio
from typing import List, Dict, Any
from evals.base import BaseEval


class RecruiterEmailHappyPathEval(BaseEval):
    """
    Evaluation setup for testing recruiter email workflows in happy path scenarios.
    This class outlines the steps needed to set up comprehensive evaluations
    for recruiter email automation workflows.
    """
    
    name = "recruiter_email_happy_path"
    description = "Happy path evaluation for recruiter email workflows"
    test_cases = [
        {
            "id": "initial-outreach-software-eng",
            "sender": "bugs.bunny@samepage.network",
            "subject": "Exploring Software Engineering Opportunities",
            "content": "Hi there! I came across your profile and was impressed by your technical background. We have some exciting opportunities that might be a great fit for your skills. Would you be open to a brief chat this week?",
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
                    "target_expression": "^(Sent|Failed to send) email to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "quick-chat-tech-experience",
            "sender": "daffy.duck@samepage.network", 
            "subject": "Your Experience in Technology - Quick Chat?",
            "content": "Hello! I'm reaching out because your experience in software development caught my attention. We're working with some innovative companies that are looking for talented engineers. Are you currently open to new opportunities?",
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
                    "target_expression": "^(Sent|Failed to send) email to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "follow-up-senior-developer",
            "sender": "porky.pig@samepage.network",
            "subject": "Following up on our previous conversation",
            "content": "Hi! I wanted to follow up on our conversation from last week about the senior developer role. The hiring manager is very interested in speaking with you. Do you have availability for a call this week?",
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
                    "target_expression": "^(Sent|Failed to send) email to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "thank-you-next-steps",
            "sender": "tweety.bird@samepage.network",
            "subject": "Thank you for connecting - Next steps",
            "content": "Thank you for taking the time to speak with me yesterday! Based on our conversation, I think you'd be a perfect fit for the lead engineer position we discussed. I'd love to set up an interview with the team. What does your schedule look like next week?",
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
                    "target_expression": "^(Sent|Failed to send) email to .+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "startup-full-stack-opportunity",
            "sender": "speedy.gonzales@samepage.network",
            "subject": "Exciting Startup Opportunity - Full Stack Developer",
            "content": "¡Hola! I hope this message finds you well. I'm working with a fast-growing startup that's looking for a full stack developer to join their core team. The role offers equity, remote work, and the chance to build something from the ground up. Interested in learning more?",
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
                    "target_expression": "^(Sent|Failed to send) email to .+\\.$",
                    "weight": 3
                }
            ]
        }
    ]
    
    def get_setup_steps(self) -> List[Dict[str, Any]]:
        """
        Returns a list of setup steps required for recruiter email happy path evaluation.
        Each step contains the action, description, and expected outcome.
        """
        return [
            {
                "step": 1,
                "action": "prepare_test_contacts",
                "description": "Create test contact profiles with realistic recruiter information",
                "details": [
                    "Generate 5-10 test recruiter contacts with varied company sizes",
                    "Include contact details: name, email, company, role, LinkedIn profile",
                    "Ensure contacts represent different industries (tech, finance, healthcare)",
                    "Set up contact preferences and communication history"
                ],
                "expected_outcome": "Test contact database populated with diverse recruiter profiles"
            },
            {
                "step": 2,
                "action": "setup_email_templates",
                "description": "Configure email templates for different recruiter scenarios",
                "details": [
                    "Create initial outreach email template",
                    "Set up follow-up email sequences (2nd, 3rd contact attempts)",
                    "Configure thank you and scheduling confirmation templates",
                    "Include personalization variables (name, company, role)",
                    "Test template rendering with sample data"
                ],
                "expected_outcome": "Email templates ready with proper personalization"
            },
            {
                "step": 3,
                "action": "configure_workflow_triggers",
                "description": "Set up triggers and conditions for email workflow execution",
                "details": [
                    "Define trigger conditions (new recruiter contact, follow-up timing)",
                    "Configure email sending schedules and frequency limits",
                    "Set up response detection and classification rules",
                    "Configure escalation paths for different response types"
                ],
                "expected_outcome": "Workflow triggers properly configured and tested"
            },
            {
                "step": 4,
                "action": "setup_success_metrics",
                "description": "Define success criteria and measurement points",
                "details": [
                    "Email delivery rate (target: >95%)",
                    "Email open rate tracking",
                    "Response rate measurement",
                    "Meeting scheduling conversion rate",
                    "Template personalization accuracy",
                    "Workflow execution timing validation"
                ],
                "expected_outcome": "Success metrics defined with measurable targets"
            },
            {
                "step": 5,
                "action": "prepare_test_scenarios",
                "description": "Create specific test scenarios for evaluation",
                "details": [
                    "Scenario 1: Cold outreach to new recruiter contact",
                    "Scenario 2: Follow-up sequence after no initial response",
                    "Scenario 3: Response handling and meeting scheduling",
                    "Scenario 4: Bulk outreach to multiple recruiters",
                    "Scenario 5: Template personalization with edge cases"
                ],
                "expected_outcome": "Comprehensive test scenarios ready for execution"
            },
            {
                "step": 6,
                "action": "setup_monitoring_and_logging",
                "description": "Configure monitoring and logging for evaluation tracking",
                "details": [
                    "Set up email delivery status tracking",
                    "Configure workflow execution logging",
                    "Enable error capture and reporting",
                    "Set up performance metrics collection",
                    "Configure alert thresholds for failures"
                ],
                "expected_outcome": "Monitoring infrastructure ready for evaluation"
            },
            {
                "step": 7,
                "action": "validate_integration_points",
                "description": "Test all external integrations and dependencies",
                "details": [
                    "Verify email service provider connection",
                    "Test CRM integration for contact management",
                    "Validate calendar integration for scheduling",
                    "Check analytics tracking implementation",
                    "Confirm backup and recovery procedures"
                ],
                "expected_outcome": "All integrations validated and working correctly"
            }
        ]
