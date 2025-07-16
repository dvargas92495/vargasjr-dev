import vellumLock from '../../vellum/vellum.lock.json';

export function getVellumSandboxUrl(workflowName: string): string | null {
  const workflow = vellumLock.workflows.find(w => {
    const moduleName = w.module.split('.').pop();
    return moduleName === workflowName || w.module === workflowName;
  });

  if (!workflow || !workflow.workflow_sandbox_id) {
    return null;
  }

  return `https://app.vellum.ai/workflows/${workflow.workflow_sandbox_id}`;
}

export function getWorkflowDeploymentId(workflowName: string): string | null {
  const workflow = vellumLock.workflows.find(w => {
    const moduleName = w.module.split('.').pop();
    return moduleName === workflowName || w.module === workflowName;
  });

  return workflow?.deployments?.[0]?.id || null;
}
