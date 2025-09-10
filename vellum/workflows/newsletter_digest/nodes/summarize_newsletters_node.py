from vellum import ChatMessagePromptBlock, JinjaPromptBlock
from vellum.workflows.nodes import InlinePromptNode, BaseNode
from .filter_newsletters_node import FilterNewslettersNode


class SummarizeNewslettersNode(InlinePromptNode):
    newsletters = FilterNewslettersNode.Outputs.newsletters
    
    prompt_inputs = {"newsletters": newsletters}
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
You are a newsletter curator and summarizer. Your task is to create a concise, engaging daily digest from the newsletters received in the last 24 hours.

Instructions:
1. Extract the most important and interesting stories/updates from each newsletter
2. Group similar topics together
3. Prioritize news that would be most relevant and valuable
4. Write in a clear, engaging style
5. Include the source newsletter name for each story
6. Keep the overall digest brief but informative

Format your response as an HTML email body with:
- A compelling subject line suggestion at the top
- Well-organized sections with clear headings
- Bullet points or short paragraphs for each story
- Source attribution for each item
- A brief closing note

If no newsletters were found, create a short message explaining that no newsletters were received in the last 24 hours.

Newsletters to summarize:
{{ newsletters | tojson }}"""
                )
            ],
        )
    ]

    class Outputs(BaseNode.Outputs):
        digest_content: str

    def run(self) -> Outputs:
        digest_content = super().run().text
        
        return self.Outputs(
            digest_content=digest_content
        )
