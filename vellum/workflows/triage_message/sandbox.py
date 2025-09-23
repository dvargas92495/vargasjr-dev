from models.types import USER
from services import create_inbox_message
from .workflow import TriageMessageWorkflow
from .inputs import Inputs
from vellum.workflows.sandbox import WorkflowSandboxRunner


if __name__ == "__main__":
    create_inbox_message(
        inbox_name="landing-page",
        source=USER.email,
        body="Hey, I need help building an ecommerce website. Can you help me?",
    )

    runner = WorkflowSandboxRunner(
        workflow=TriageMessageWorkflow(),
        inputs=[
            Inputs(),
        ],
    )
    runner.run()
