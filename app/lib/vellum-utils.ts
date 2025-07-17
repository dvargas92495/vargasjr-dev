interface WorkflowDeployment {
  id: string;
  name: string;
  workflow_sandbox_id?: string;
}

export async function getVellumSandboxUrl(workflowName: string): Promise<string | null> {
  try {
    const response = await fetch('/api/vellum/workflow-deployments');
    if (!response.ok) {
      console.error('Failed to fetch workflow deployments');
      return null;
    }
    
    const deployments: WorkflowDeployment[] = await response.json();
    const deployment = deployments.find(d => d.name === workflowName);
    
    if (!deployment || !deployment.workflow_sandbox_id) {
      return null;
    }

    return `https://app.vellum.ai/workflow_sandboxes/${deployment.workflow_sandbox_id}`;
  } catch (error) {
    console.error('Error fetching workflow deployments:', error);
    return null;
  }
}

export async function getWorkflowDeploymentId(workflowName: string): Promise<string | null> {
  try {
    const response = await fetch('/api/vellum/workflow-deployments');
    if (!response.ok) {
      return null;
    }
    
    const deployments: WorkflowDeployment[] = await response.json();
    const deployment = deployments.find(d => d.name === workflowName);
    
    return deployment?.id || null;
  } catch (error) {
    console.error('Error fetching workflow deployments:', error);
    return null;
  }
}
