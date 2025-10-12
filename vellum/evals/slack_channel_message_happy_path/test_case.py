#!/usr/bin/env python3

import asyncio
from typing import List, Dict, Any
from evals.base import BaseEval


class SlackChannelMessageHappyPathEval(BaseEval):
    """
    Evaluation setup for testing Slack channel message workflows in happy path scenarios.
    This class outlines the steps needed to set up comprehensive evaluations
    for Slack channel message automation workflows.
    """
    
    name = "slack_channel_message_happy_path"
    description = "Happy path evaluation for Slack channel message workflows"
    test_cases = [
        {
            "id": "simple-text-message",
            "type": "simple_text",
            "description": "Plain text message",
            "example": "Daily standup reminder: Please share your updates!",
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
                    "target_expression": "^Sent Slack reply to .+ at #.+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "rich-formatting-blocks",
            "type": "rich_formatting",
            "description": "Message with formatting and blocks",
            "example": "System alert with severity level and action buttons",
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
                    "target_expression": "^Sent Slack reply to .+ at #.+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "interactive-buttons",
            "type": "interactive",
            "description": "Message with buttons and user interactions",
            "example": "Deployment approval request with approve/reject buttons",
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
                    "target_expression": "^Sent Slack reply to .+ at #.+\\.$",
                    "weight": 3
                }
            ]
        },
        {
            "id": "threaded-conversation",
            "type": "threaded",
            "description": "Message that starts or continues a thread",
            "example": "Follow-up message in existing conversation thread",
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
                    "target_expression": "^Sent Slack reply to .+ at #.+\\.$",
                    "weight": 3
                }
            ]
        }
    ]
    
    def get_setup_steps(self) -> List[Dict[str, Any]]:
        """
        Returns a list of setup steps required for Slack channel message happy path evaluation.
        Each step contains the action, description, and expected outcome.
        """
        return [
            {
                "step": 1,
                "action": "setup_test_workspace",
                "description": "Create and configure test Slack workspace environment",
                "details": [
                    "Set up dedicated test Slack workspace",
                    "Create test channels for different scenarios (#general, #dev-updates, #notifications)",
                    "Configure workspace permissions and settings",
                    "Add test bot user with appropriate permissions",
                    "Set up webhook URLs and API tokens"
                ],
                "expected_outcome": "Test Slack workspace ready with proper bot permissions"
            },
            {
                "step": 2,
                "action": "configure_test_channels",
                "description": "Set up various channel types for comprehensive testing",
                "details": [
                    "Create public channels for general announcements",
                    "Set up private channels for sensitive notifications",
                    "Configure channel-specific posting rules and permissions",
                    "Add test users to channels with different permission levels",
                    "Set up channel topics and descriptions"
                ],
                "expected_outcome": "Diverse channel setup covering all use cases"
            },
            {
                "step": 3,
                "action": "prepare_message_templates",
                "description": "Create message templates for different notification types",
                "details": [
                    "Design templates for system alerts and notifications",
                    "Create templates for deployment and CI/CD updates",
                    "Set up templates for user engagement messages",
                    "Configure rich message formatting (blocks, attachments, buttons)",
                    "Include dynamic content placeholders and variables"
                ],
                "expected_outcome": "Message templates ready with proper formatting"
            },
            {
                "step": 4,
                "action": "setup_workflow_triggers",
                "description": "Configure triggers and conditions for message workflows",
                "details": [
                    "Define trigger events (time-based, webhook-based, user actions)",
                    "Set up message scheduling and frequency controls",
                    "Configure conditional logic for different message types",
                    "Set up escalation and retry mechanisms",
                    "Configure rate limiting and spam prevention"
                ],
                "expected_outcome": "Workflow triggers properly configured and tested"
            },
            {
                "step": 5,
                "action": "define_success_metrics",
                "description": "Establish success criteria and measurement points",
                "details": [
                    "Message delivery success rate (target: >99%)",
                    "Message formatting accuracy validation",
                    "Response time measurement for triggered messages",
                    "User engagement metrics (reactions, replies, clicks)",
                    "Error rate tracking and alerting",
                    "Channel-specific delivery confirmation"
                ],
                "expected_outcome": "Success metrics defined with measurable targets"
            },
            {
                "step": 6,
                "action": "create_test_scenarios",
                "description": "Develop specific test scenarios for evaluation",
                "details": [
                    "Scenario 1: Scheduled daily standup reminder messages",
                    "Scenario 2: Real-time system alert notifications",
                    "Scenario 3: Bulk announcement to multiple channels",
                    "Scenario 4: Interactive message with buttons and responses",
                    "Scenario 5: Thread-based conversation management",
                    "Scenario 6: File and media attachment handling"
                ],
                "expected_outcome": "Comprehensive test scenarios ready for execution"
            },
            {
                "step": 7,
                "action": "setup_monitoring_infrastructure",
                "description": "Configure monitoring and logging for evaluation tracking",
                "details": [
                    "Set up message delivery status tracking",
                    "Configure workflow execution logging",
                    "Enable error capture and reporting",
                    "Set up performance metrics collection",
                    "Configure alert thresholds for failures",
                    "Implement audit trail for message history"
                ],
                "expected_outcome": "Monitoring infrastructure ready for evaluation"
            },
            {
                "step": 8,
                "action": "validate_integration_points",
                "description": "Test all Slack API integrations and dependencies",
                "details": [
                    "Verify Slack API connection and authentication",
                    "Test webhook endpoint reliability",
                    "Validate message formatting and rendering",
                    "Check rate limiting compliance",
                    "Confirm error handling and recovery procedures",
                    "Test cross-workspace functionality if applicable"
                ],
                "expected_outcome": "All integrations validated and working correctly"
            },
            {
                "step": 9,
                "action": "prepare_user_interaction_tests",
                "description": "Set up tests for user interactions and responses",
                "details": [
                    "Configure test users for interaction simulation",
                    "Set up automated response validation",
                    "Create test cases for button clicks and form submissions",
                    "Configure thread and reply handling tests",
                    "Set up mention and notification tests",
                    "Prepare emoji reaction and engagement tests"
                ],
                "expected_outcome": "User interaction testing framework ready"
            }
        ]
