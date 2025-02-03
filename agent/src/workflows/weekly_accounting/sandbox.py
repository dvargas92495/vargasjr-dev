import logging
from dotenv import load_dotenv
from src.workflows.weekly_accounting.workflow import WeeklyAccountingWorkflow
from vellum.workflows.sandbox import WorkflowSandboxRunner
from vellum.workflows.inputs import BaseInputs
from vellum.workflows.state.context import WorkflowContext

if __name__ != "__main__":
    raise Exception("This is a sandbox file and should not be run as a module")

logger = logging.getLogger(__name__)

load_dotenv()
context = WorkflowContext()
setattr(context, "logger", logger)

runner = WorkflowSandboxRunner(
    workflow=WeeklyAccountingWorkflow(),
    inputs=[BaseInputs()],
)

runner.run()
