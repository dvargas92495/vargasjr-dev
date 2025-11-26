import hashlib
import logging
import re
from html.parser import HTMLParser
from typing import Any, Dict
from vellum import (
    ChatMessagePromptBlock,
    JinjaPromptBlock,
    PromptParameters,
)
from vellum.workflows.nodes import InlinePromptNode
from vellum.workflows.state import BaseState
import requests
from services import ActionRecord
from services.aws import get_aws_session, generate_s3_key
from services.constants import S3_MEMORY_BUCKET
from .parse_function_call_node import ParseFunctionCallNode

logger = logging.getLogger(__name__)


class HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text_parts: list[str] = []
        self.skip_tags = {"script", "style", "head", "meta", "link", "noscript"}
        self.current_skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.skip_tags:
            self.current_skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.skip_tags and self.current_skip_depth > 0:
            self.current_skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.current_skip_depth == 0:
            text = data.strip()
            if text:
                self.text_parts.append(text)

    def get_text(self) -> str:
        return " ".join(self.text_parts)


def extract_text_from_html(html: str) -> str:
    parser = HTMLTextExtractor()
    parser.feed(html)
    text = parser.get_text()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def generate_url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


class LookupUrlNode(InlinePromptNode):
    parameters_input = ParseFunctionCallNode.Outputs.parameters
    ml_model = "gpt-4o-mini"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""You are summarizing the content of a webpage. Provide a brief 2-3 sentence summary \
that captures the main purpose and key information on the page. Be concise and informative.

URL: {{ url }}

Page content:
{{ content }}

Provide a 2-3 sentence summary of what this webpage is about.""",
                ),
            ],
        ),
    ]
    prompt_inputs: Dict[str, Any] = {}
    parameters = PromptParameters(
        max_tokens=200,
    )

    class Outputs(InlinePromptNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        try:
            url = self.parameters_input.get("url", "")
        except (AttributeError, KeyError):
            url = ""

        if not url:
            error_msg = "No URL provided"
            self._append_action_history("lookup_url", {"url": url}, error_msg)
            return self.Outputs(
                results=[],
                text=error_msg,
                summary=error_msg,
            )

        args = {"url": url}

        try:
            content = self._fetch_and_store_webpage(url)
            if content.startswith("Error"):
                self._append_action_history("lookup_url", args, content)
                return self.Outputs(
                    results=[],
                    text=content,
                    summary=content,
                )

            self.prompt_inputs = {
                "url": url,
                "content": content[:10000],
            }

            result = super().run()
            summary = result.text

            self._append_action_history("lookup_url", args, summary)

            return self.Outputs(
                results=result.results,
                text=summary,
                summary=summary,
            )

        except Exception as e:
            logger.exception(f"Error looking up URL: {str(e)}")
            error_msg = f"Error looking up URL: {str(e)}"
            self._append_action_history("lookup_url", args, error_msg)
            return self.Outputs(
                results=[],
                text=error_msg,
                summary=error_msg,
            )

    def _append_action_history(self, name: str, args: Dict[str, Any], result: str) -> None:
        action_record = ActionRecord(name=name, args=args, result=result)
        if not hasattr(self.state, "action_history"):
            self.state.action_history = []
        self.state.action_history.append(action_record)

    def _fetch_and_store_webpage(self, url: str) -> str:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; VargasJR/1.0; +https://vargasjr.dev)"
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            html_content = response.text
            text_content = extract_text_from_html(html_content)

            if not text_content:
                return "Error: Could not extract text content from the webpage"

            url_hash = generate_url_hash(url)
            self._store_in_s3(url_hash, url, text_content)

            return text_content

        except requests.exceptions.Timeout:
            return "Error: Request timed out while fetching the webpage"
        except requests.exceptions.RequestException as e:
            return f"Error fetching webpage: {str(e)}"

    def _store_in_s3(self, url_hash: str, url: str, content: str) -> None:
        try:
            session = get_aws_session()
            s3_client = session.client("s3")

            storage_content = f"URL: {url}\n\n---\n\n{content}"

            base_key = f"webpages/{url_hash}.txt"
            key = generate_s3_key(base_key)

            s3_client.put_object(
                Bucket=S3_MEMORY_BUCKET,
                Key=key,
                Body=storage_content.encode("utf-8"),
                ContentType="text/plain",
            )

            del s3_client
            del session

        except Exception as e:
            logger.warning(f"Failed to store webpage in S3: {str(e)}")
