from vellum import ChatMessagePromptBlock, JinjaPromptBlock, PromptParameters
from vellum.workflows.nodes import InlinePromptNode
from ..models import generate_tweets


class GenerateTweetContent(InlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
Generate engaging Twitter content for a personal/professional account. The content should be:
- Authentic and personal
- Valuable to followers (insights, tips, thoughts)
- Appropriate for a software engineer/entrepreneur
- Under 280 characters
- Engaging and likely to drive interaction

Create 3 different tweet options with different styles:
1. A professional insight or tip
2. A personal reflection or observation
3. An industry trend or commentary

For each tweet, provide:
- Text (under 280 characters)
- Hashtags (2-4 relevant hashtags)
"""
                )
            ],
        )
    ]
    functions = [
        generate_tweets,
    ]
    parameters = PromptParameters(
        temperature=0.8,
        max_tokens=2000,
    )
