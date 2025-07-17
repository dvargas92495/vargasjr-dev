import { VellumClient } from 'vellum-ai';

interface WorkflowDeployment {
  id: string;
  name: string;
  workflow_sandbox_id?: string;
}

export async function getVellumSandboxUrlServer(workflowName: string): Promise<string | null> {
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    
    if (!apiKey) {
      console.error("VELLUM_API_KEY environment variable is missing");
      return null;
    }

    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    const response = await vellumClient.workflowDeployments.list();
    const deployments: WorkflowDeployment[] = response.results || [];
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

export async function getAllWorkflowDeployments(): Promise<WorkflowDeployment[]> {
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    
    if (!apiKey) {
      console.error("VELLUM_API_KEY environment variable is missing");
      return [];
    }

    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    const response = await vellumClient.workflowDeployments.list();
    return response.results || [];
  } catch (error) {
    console.error('Error fetching workflow deployments:', error);
    return [];
  }
}
