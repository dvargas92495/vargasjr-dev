import os
from dotenv import load_dotenv
from .workflow import CreateDevinChatWorkflow
from .inputs import Inputs
from vellum.workflows.sandbox import WorkflowSandboxRunner

if __name__ == "__main__":
    load_dotenv()
    
    inputs = Inputs(issue_number=59)
    
    runner = WorkflowSandboxRunner(
        workflow=CreateDevinChatWorkflow(),
        inputs=[inputs],
    )
    
    result = runner.run()
    print(f"Workflow result: {result}")
