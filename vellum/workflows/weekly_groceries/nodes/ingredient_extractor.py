from vellum import (
    ChatMessagePromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
    VariablePromptBlock,
)
from vellum.workflows.nodes.displayable import InlinePromptNode

from .meal_planner import MealPlanner


class IngredientExtractor(InlinePromptNode):
    """Extracts and consolidates all ingredients from the meal plan into a comprehensive shopping list."""

    ml_model = "gpt-5-responses"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="""\
You are a grocery shopping expert. Analyze the provided meal plan and create a comprehensive, organized shopping list.

Your task:
1. Extract ALL ingredients from every recipe in the meal plan
2. Consolidate duplicate ingredients (e.g., if multiple recipes need onions, combine the quantities)
3. Organize ingredients by grocery store sections (Produce, Meat & Seafood, Dairy, Pantry, etc.)
4. Include exact quantities needed
5. Add any basic staples that might be missing (salt, pepper, cooking oil, etc.)
6. Format as a clean, organized shopping list

Meal Plan:
\
"""
                        ),
                        VariablePromptBlock(input_variable="meal_plan"),
                        PlainTextPromptBlock(
                            text="""\


Format your response as a well-organized shopping list with clear categories and quantities. Make it easy to use while shopping at Whole Foods or similar grocery stores.

Example format:
**PRODUCE**
- 3 large onions
- 2 lbs carrots
- 1 bunch spinach

**MEAT & SEAFOOD**
- 2 lbs chicken breast
- 1 lb salmon fillets

Continue this format for all categories.\
"""
                        ),
                    ]
                )
            ],
        ),
    ]
    prompt_inputs = {
        "meal_plan": MealPlanner.Outputs.text,
    }
    parameters = PromptParameters(
        stop=[],
        temperature=0.3,
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
