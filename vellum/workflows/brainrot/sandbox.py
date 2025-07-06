import logging
from workflows.brainrot.workflow import BrainrotWorkflow
from dotenv import load_dotenv
from vellum.workflows.state.context import WorkflowContext

load_dotenv()
logger = logging.getLogger(__name__)


if __name__ == "__main__":
    context = WorkflowContext()
    setattr(context, "logger", logger)
    workflow = BrainrotWorkflow(context=context)
    final_event = workflow.run()
    if final_event.name != "workflow.execution.fulfilled":
        raise Exception(f"Workflow failed: {final_event}")

    print(final_event.outputs)
