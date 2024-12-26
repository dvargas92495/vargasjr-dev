import os
from sqlalchemy import create_engine
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from sqlmodel import Session, select
from agent.models.contact_form_response import ContactFormResponse


class InboxMessage(UniversalBaseModel):
    message_id: int
    body: str


class ReadMessageNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        message: InboxMessage

    def run(self) -> Outputs:
        url = os.getenv("POSTGRES_URL")
        if not url:
            raise ValueError("POSTGRES_URL is not set")

        engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
        with Session(engine) as session:
            statement = select(ContactFormResponse).order_by(ContactFormResponse.created_at.desc())
            result = session.exec(statement).first()

        if not result:
            return self.Outputs(
                message=InboxMessage(
                    message_id=0,
                    body="No messages found",
                )
            )

        return self.Outputs(
            message=InboxMessage(
                message_id=result.id,
                body=result.message,
            )
        )


class TriageMessageWorkflow(BaseWorkflow):
    graph = ReadMessageNode

    class Outputs(BaseWorkflow.Outputs):
        message = ReadMessageNode.Outputs.message["body"]
