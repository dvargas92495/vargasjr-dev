from .workflow import TriageMessageWorkflow
from vellum.workflows.sandbox import WorkflowSandboxRunner
from vellum.workflows.inputs import BaseInputs


if __name__ == "__main__":
    runner = WorkflowSandboxRunner(
        workflow=TriageMessageWorkflow(),
        inputs=[
            BaseInputs(),
        ],
    )
    runner.run()
