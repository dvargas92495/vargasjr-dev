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

from ..ingredient_extractor import IngredientExtractor


class WholeFoodsOrder(ToolCallingNode):
    ml_model = "gpt-5-responses"
    system_prompt = "You are a Whole Foods ordering assistant. Your job is to:\n\n1. Take the provided shopping list\n2. Search for each item on Amazon/Whole Foods\n3. Add items to cart with the correct quantities\n4. Complete the order placement\n\nBe thorough in finding the right products. If you can't find an exact match, choose the closest high-quality alternative available on Whole Foods. Focus on organic and fresh options when available.\n\nShopping List to order:\n{{ shopping_list }}\n\nPlease proceed to search for items, add them to cart, and place the order."
    prompt_inputs = {
        "shopping_list": IngredientExtractor.Outputs.text,
    }
    tools = []
    max_tool_iterations = 20
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                RichTextPromptBlock(
                    blocks=[
                        PlainTextPromptBlock(
                            text="""You will be given a shopping list. Use your browser tools to create a cart ready for purchase at Whole Foods through Amazon"""
                        )
                    ]
                )
            ],
        ),
        ChatMessagePromptBlock(
            chat_role="USER", blocks=[RichTextPromptBlock(blocks=[VariablePromptBlock(input_variable="shopping_list")])]
        ),
    ]
    functions = []
    parameters = PromptParameters(
        stop=[],
        temperature=0.1,
        max_tokens=4096,
        top_p=1,
        top_k=0,
        frequency_penalty=0,
        presence_penalty=0,
        logit_bias=None,
        custom_parameters=None,
    )
    max_prompt_iterations = 10

    class Outputs(ToolCallingNode.Outputs):
        text: str
        chat_history: List[ChatMessage]
