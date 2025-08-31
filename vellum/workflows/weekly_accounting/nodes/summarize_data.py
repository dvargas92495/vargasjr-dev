from vellum import ChatMessagePromptBlock, JinjaPromptBlock
from vellum.workflows.nodes import InlinePromptNode
from .get_summary_data import GetSummaryData


class SummarizeData(InlinePromptNode):
    prompt_inputs = {"data": GetSummaryData.Outputs.data}
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
You are my personal financial assistant. Below is a JSON object with the summary of my financial data \
and you're going to write the body of the email that contains all of the data in a digestible format. \
Feel free to include any humor, personality, and optimism you see fit. When you sign off, your name is \
"Vargas JR". When you do breakdowns, DO NOT add commentary on each bullet, save it for after the bullets. \

{{ data }}"""
                )
            ],
        )
    ]
