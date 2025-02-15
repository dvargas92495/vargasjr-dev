from src.workflows.brainrot.workflow import BrainrotWorkflow
from dotenv import load_dotenv

load_dotenv()


if __name__ == "__main__":
    workflow = BrainrotWorkflow()
    final_event = workflow.run()
    if final_event.name != "workflow.execution.fulfilled":
        raise Exception(f"Workflow failed: {final_event}")

    print(final_event.outputs)
