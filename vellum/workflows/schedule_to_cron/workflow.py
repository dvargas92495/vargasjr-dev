import logging
from vellum import ChatMessagePromptBlock, JinjaPromptBlock, PromptParameters
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import InlinePromptNode
from vellum.workflows.state import BaseState
from .inputs import ScheduleToCronInputs

logger = logging.getLogger(__name__)


def generate_cron_expression(cron_expression: str):
    """
    Generate a cron expression from a natural language schedule description.
    
    Args:
        cron_expression: The cron expression in standard format (minute hour day month weekday)
    """
    pass


class ScheduleToCronNode(InlinePromptNode):
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
You are a cron expression generator. Your task is to convert natural language schedule descriptions into valid cron expressions.

Cron format: minute hour day_of_month month day_of_week
- minute: 0-59
- hour: 0-23 (24-hour format)
- day_of_month: 1-31
- month: 1-12
- day_of_week: 0-7 (0 and 7 are Sunday)

Use * for "any" value.

Examples:
- "every Monday at 5pm" → "0 17 * * 1"
- "daily at 9am" → "0 9 * * *"
- "every weekday at 8:30am" → "30 8 * * 1-5"
- "every Sunday at midnight" → "0 0 * * 0"
- "twice a day at 6am and 6pm" → "0 6,18 * * *"
- "every 15 minutes" → "*/15 * * * *"
- "first day of every month at noon" → "0 12 1 * *"

Convert the following schedule description to a cron expression. Return ONLY the cron expression, no explanation.\
"""
                )
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER",
            blocks=[
                JinjaPromptBlock(
                    template="{{ schedule_description }}"
                ),
            ],
        ),
    ]
    prompt_inputs = {
        "schedule_description": ScheduleToCronInputs.schedule_description,
    }
    functions = [
        generate_cron_expression,
    ]
    parameters = PromptParameters(
        temperature=0.1,
        max_tokens=100,
        custom_parameters={
            "tool_choice": "required",
        },
    )


class ScheduleToCronWorkflow(BaseWorkflow[ScheduleToCronInputs, BaseState]):
    graph = ScheduleToCronNode

    class Outputs(BaseWorkflow.Outputs):
        cron_expression = ScheduleToCronNode.Outputs.results[0]["value"]["arguments"]["cron_expression"]
