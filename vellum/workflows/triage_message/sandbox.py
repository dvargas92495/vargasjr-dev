from models.types import USER
from services import create_inbox_message
from .workflow import TriageMessageWorkflow
from vellum.workflows.sandbox import WorkflowSandboxRunner
from vellum.workflows.inputs import BaseInputs


if __name__ == "__main__":
    create_inbox_message(
        inbox_name="landing-page",
        source=USER.email,
        body="Hey, I need help building an ecommerce website. Can you help me?",
    )

    runner = WorkflowSandboxRunner(
        workflow=TriageMessageWorkflow(),
        inputs=[
            BaseInputs(),
        ],
    )
    runner.run()
