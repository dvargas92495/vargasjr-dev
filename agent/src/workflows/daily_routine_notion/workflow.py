import logging
import requests
from datetime import datetime
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode


class PublishToNotionNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        logger: logging.Logger = getattr(self._context, "logger")
        
        current_date = datetime.now().strftime("%Y-%m-%d")
        summary = f"Daily routine skeleton prepared for {current_date} (Notion integration pending)"
        logger.info(summary)
        
        return self.Outputs(summary=summary)


class DailyRoutineNotionWorkflow(BaseWorkflow):
    graph = PublishToNotionNode

    class Outputs(BaseWorkflow.Outputs):
        summary = PublishToNotionNode.Outputs.summary
