import logging
import requests
import json
from datetime import datetime
from typing import Optional
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from services import get_application_with_workspace_by_name

DAILY_ROUTINE_ITEMS = [
    "Review today's calendar and priorities",
    "Check and respond to urgent emails",
    "Review yesterday's progress and learnings",
    "Plan top 3 priorities for today",
    "Check project status updates"
]


class PublishToNotionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        logger: logging.Logger = getattr(self._context, "logger", logging.getLogger(__name__))
        
        try:
            notion_app = get_application_with_workspace_by_name("Notion")
            if not notion_app:
                error_msg = "Notion application not found in database"
                logger.error(error_msg)
                return self.Outputs(summary=error_msg)

            if not notion_app['access_token']:
                error_msg = "Notion access token not configured"
                logger.error(error_msg)
                return self.Outputs(summary=error_msg)

            if not notion_app['workspace_id']:
                error_msg = "Notion page ID not configured in workspace_id field"
                logger.error(error_msg)
                return self.Outputs(summary=error_msg)

            page_id = notion_app['workspace_id']
            access_token = notion_app['access_token']

            blocks = []
            for item in DAILY_ROUTINE_ITEMS:
                block = {
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": item}
                            }
                        ]
                    }
                }
                blocks.append(block)

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28"
            }

            payload = {"children": blocks}

            response = requests.patch(
                f"https://api.notion.com/v1/blocks/{page_id}/children",
                headers=headers,
                json=payload
            )

            if response.status_code == 200:
                current_date = datetime.now().strftime("%Y-%m-%d")
                success_msg = f"Successfully posted {len(DAILY_ROUTINE_ITEMS)} daily routine items to Notion page on {current_date}"
                logger.info(success_msg)
                return self.Outputs(summary=success_msg)
            else:
                error_msg = f"Failed to post to Notion: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return self.Outputs(summary=error_msg)

        except Exception as e:
            error_msg = f"Error posting daily routine to Notion: {str(e)}"
            logger.exception(error_msg)
            return self.Outputs(summary=error_msg)


class DailyRoutineNotionWorkflow(BaseWorkflow):
    graph = PublishToNotionNode

    class Outputs(BaseWorkflow.Outputs):
        summary = PublishToNotionNode.Outputs.summary
