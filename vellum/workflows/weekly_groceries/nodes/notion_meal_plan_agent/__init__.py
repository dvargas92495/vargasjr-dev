from typing import List

from vellum import (
    ChatMessage,
    ChatMessagePromptBlock,
    PlainTextPromptBlock,
    PromptParameters,
    RichTextPromptBlock,
    VariablePromptBlock,
)
from vellum.workflows.nodes.displayable.tool_calling_node.node import ToolCallingNode
from vellum.workflows.types.definition import ComposioToolDefinition

from ..meal_planner import MealPlanner


class NotionMealPlanAgent(ToolCallingNode):
    ml_model = "gpt-4.1"
    system_prompt = 'You are a Notion page creation assistant. Your job is to:\n\n1. Create a new Notion page with the title format: "@Last Sunday - @This Saturday" \n   - Use proper Notion date references (@) in the title\n   - The dates should represent the current week (last Sunday through this Saturday)\n2. Add the provided meal plan content to the page\n3. Use Notion\'s append content functionality to structure the meal plan nicely\n4. Format the content with proper headings and organization for easy reading\n\nMeal Plan Content:\n{{ meal_plan }}\n\nPlease create the page and add all the meal plan content with proper formatting.'
    prompt_inputs = {
        "meal_plan": MealPlanner.Outputs.text,
    }
    tools: list = []
    max_tool_iterations = 20
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="""You have been given a weekly recipe plan by the user. Use your notion tools to upload this to the proper page in Notion. It should go inside of a Page called \"Grocery & Dinners\""""
                        )
                    ]
                )
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER", blocks=[RichTextPromptBlock(blocks=[VariablePromptBlock(input_variable="meal_plan")])]
        ),
    ]
    functions = [
        ComposioToolDefinition(
            toolkit="notion",
            action="NOTION_ADD_PAGE_CONTENT",
            description="Deprecated: appends a single content block to a notion page or a parent block (must be page, toggle, to-do, bulleted/numbered list, callout, or quote); invoke repeatedly to add multiple blocks.",
            user_id="vargas",
        ),
        ComposioToolDefinition(
            toolkit="notion",
            action="NOTION_ADD_MULTIPLE_PAGE_CONTENT",
            description="Efficiently adds multiple standard content blocks to a notion page in a single api call with automatic markdown parsing. the 'content' field in notionrichtext blocks now automatically detects and parses markdown formatting including headers (# ## ###), bold (**text**), italic (*text*), strikethrough (~~text~~), inline code (`code`), links ([text](url)), and more. ideal for bulk content creation, ai agents, and replacing multiple individual add page content calls. supports automatic text formatting, content splitting, and up to 100 blocks per request.",
            user_id="vargas",
        ),
        ComposioToolDefinition(
            toolkit="notion",
            action="NOTION_CREATE_NOTION_PAGE",
            description="Creates a new empty page in a notion workspace.",
            user_id="vargas",
        ),
        ComposioToolDefinition(
            toolkit="notion",
            action="NOTION_SEARCH_NOTION_PAGE",
            description="Searches notion pages and databases by title; an empty query lists all accessible items, useful for discovering ids or as a fallback when a specific query yields no results.",
            user_id="vargas",
        ),
    ]
    parameters = PromptParameters(
        stop=[],
        temperature=0.1,
        max_tokens=128000,
        top_p=1,
        top_k=0,
        frequency_penalty=0,
        presence_penalty=0,
        logit_bias=None,
        custom_parameters={
            "json_mode": False,
        },
    )
    max_prompt_iterations = 10
    settings = {
        "stream_enabled": False,
    }

    class Outputs(ToolCallingNode.Outputs):
        text: str
        chat_history: List[ChatMessage]
