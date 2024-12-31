import os
from uuid import UUID, uuid4
from sqlalchemy import create_engine
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from sqlmodel import Session, select
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from agent.models.inbox_message import InboxMessage


class SlimMessage(UniversalBaseModel):
    message_id: UUID
    body: str


class ReadMessageNode(BaseNode):
    class Outputs(BaseNode.Outputs):
        message: SlimMessage

    def run(self) -> Outputs:
        url = os.getenv("POSTGRES_URL")
        if not url:
            raise ValueError("POSTGRES_URL is not set")

        engine = create_engine(url.replace("postgres://", "postgresql+psycopg://"))
        with Session(engine) as session:
            statement = select(InboxMessage).order_by(InboxMessage.created_at.desc())
            result = session.exec(statement).first()

        if not result:
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                )
            )

        return self.Outputs(
            message=SlimMessage(
                message_id=result.id,
                body=result.body,
            )
        )


class TriageMessageWorkflow(BaseWorkflow):
    graph = ReadMessageNode

    class Outputs(BaseWorkflow.Outputs):
        message = ReadMessageNode.Outputs.message["body"]
