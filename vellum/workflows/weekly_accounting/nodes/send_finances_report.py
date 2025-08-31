import logging
from datetime import datetime
from models.types import USER
from services.aws import send_email
from vellum.workflows.nodes import BaseNode
from .summarize_data import SummarizeData


class SendFinancesReport(BaseNode):
    message = SummarizeData.Outputs.text

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        logger = getattr(self._context, "logger", logging.getLogger(__name__))

        try:
            to_email = USER.email
            date = datetime.now().strftime("%m/%d/%Y")
            send_email(
                to=to_email,
                body=self.message,
                subject=f"Financial Summary for {date}",
            )
            return self.Outputs(summary=f"Sent financial summary to {to_email}")
        except Exception:
            logger.exception("Failed to send email")

        return self.Outputs(summary=self.message)
