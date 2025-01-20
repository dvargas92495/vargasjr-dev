import logging
import sys
from dotenv import load_dotenv
from src.workflows.make_sports_bets.workflow import Inputs, MakeSportsBetsWorkflow
from vellum.workflows.state.context import WorkflowContext

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    load_dotenv()
    context = WorkflowContext()
    setattr(context, "logger", logger)
    workflow = MakeSportsBetsWorkflow(context=context)
    final_event = workflow.run()
    if final_event.name != "workflow.execution.fulfilled":
        raise Exception("Workflow failed" + str(final_event))

    print(final_event.outputs.summary)
