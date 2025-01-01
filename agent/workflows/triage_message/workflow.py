import os
from uuid import UUID, uuid4
import psycopg
from sqlalchemy import create_engine
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from sqlmodel import Session, select
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from agent.models.inbox_message import InboxMessage
from agent.models.inbox_message_operation import InboxMessageOperation
from agent.models.types import InboxMessageOperationType


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
        try:
            with Session(engine) as session:
                statement = (
                    select(InboxMessage)
                    .join(
                        InboxMessageOperation, InboxMessageOperation.inbox_message_id == InboxMessage.id, isouter=True
                    )
                    .where(InboxMessageOperation.operation.is_(None))
                    .order_by(InboxMessage.created_at.desc())
                )

                result = session.exec(statement).first()

                if not result:
                    return self.Outputs(
                        message=SlimMessage(
                            message_id=uuid4(),
                            body="No messages found",
                        )
                    )

                session.add(
                    InboxMessageOperation(
                        inbox_message_id=result.id,
                        operation=InboxMessageOperationType.READ,
                    )
                )
                session.commit()
                message = SlimMessage(
                    message_id=result.id,
                    body=result.body,
                )
        except psycopg.OperationalError:
            # I suppose the agent could spin down while the agent is running, so we need to cancel this case.
            return self.Outputs(
                message=SlimMessage(
                    message_id=uuid4(),
                    body="No messages found",
                )
            )

        return self.Outputs(message=message)


class TriageMessageWorkflow(BaseWorkflow):
    graph = ReadMessageNode

    class Outputs(BaseWorkflow.Outputs):
        message = ReadMessageNode.Outputs.message["body"]
