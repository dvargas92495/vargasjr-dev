from src.workflows.weekly_accounting.workflow import WeeklyAccountingWorkflow
from vellum.workflows.sandbox import WorkflowSandboxRunner
from vellum.workflows.inputs import BaseInputs

if __name__ != "__main__":
    raise Exception("This is a sandbox file and should not be run as a module")

runner = WorkflowSandboxRunner(
    workflow=WeeklyAccountingWorkflow(),
    inputs=[BaseInputs()],
)

runner.run()
