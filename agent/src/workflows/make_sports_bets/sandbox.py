from dotenv import load_dotenv
from src.workflows.make_sports_bets.workflow import Inputs, MakeSportsBetsWorkflow

if __name__ == "__main__":
    load_dotenv()
    workflow = MakeSportsBetsWorkflow()
    inputs = Inputs(initial_balance=122.98)
    final_event = workflow.run(inputs=inputs)
    if final_event.name != "workflow.execution.fulfilled":
        raise Exception("Workflow failed" + str(final_event))

    print(final_event.outputs.summary)
