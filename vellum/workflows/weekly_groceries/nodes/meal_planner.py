from vellum import (
    ChatMessagePromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
    VariablePromptBlock,
)
from vellum.workflows.nodes.displayable import InlinePromptNode

from ..inputs import Inputs


class MealPlanner(InlinePromptNode):
    """Generates a comprehensive weekly meal plan based on dietary requirements and health goals."""

    ml_model = "gpt-5-responses"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="""\
You are a professional nutritionist and meal planning expert. Create a comprehensive weekly meal plan that includes:

1. 7 days of meals (breakfast, lunch, dinner, and 2 snacks per day)
2. Detailed recipes with exact ingredients and quantities
3. Nutritional considerations aligned with health goals
4. Cooking instructions for each meal
5. Prep time and cooking time estimates

Format your response as a structured meal plan with clear sections for each day and meal type.

Dietary Requirements: \
"""
                        ),
                        VariablePromptBlock(input_variable="dietary_requirements"),
                        PlainTextPromptBlock(
                            text="""\


Health Goals: \
"""
                        ),
                        VariablePromptBlock(input_variable="health_goals"),
                        PlainTextPromptBlock(
                            text="""\


Number of People: \
"""
                        ),
                        VariablePromptBlock(input_variable="number_of_people"),
                        PlainTextPromptBlock(
                            text="""\


Ensure all recipes are detailed with:
- Exact ingredient quantities
- Step-by-step cooking instructions
- Prep and cook times
- Nutritional highlights
- Any substitution suggestions for dietary restrictions

Make the meal plan varied, balanced, and exciting while staying within the specified constraints.\
"""
                        ),
                    ]
                )
            ],
        ),
    ]
    prompt_inputs = {
        "dietary_requirements": Inputs.dietary_requirements,
        "health_goals": Inputs.health_goals,
        "number_of_people": Inputs.number_of_people,
    }
    parameters = PromptParameters(
        stop=[],
        temperature=0.7,
        max_tokens=128000,
        top_p=1,
        top_k=0,
        frequency_penalty=0,
        presence_penalty=0,
        logit_bias={},
        custom_parameters={
            "json_mode": False,
        },
    )
