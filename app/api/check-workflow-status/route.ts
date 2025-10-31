import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../lib/github-auth";
import { withApiWrapper } from "@/utils/api-wrapper";
import { UnauthorizedError } from "@/server/errors";

interface WorkflowRun {
  path: string;
  status: string;
  id: number;
  created_at: string;
  html_url: string;
}

interface WorkflowStatusResponse {
  hasRunningWorkflow: boolean;
  workflowRunId?: number;
  createdAt?: string;
  htmlUrl?: string;
}

async function checkWorkflowStatusHandler(): Promise<WorkflowStatusResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new UnauthorizedError();
  }

  const headers = await getGitHubAuthHeaders();

  const response = await fetch(
    `https://api.github.com/repos/dvargas92495/vargasjr-dev/actions/runs?branch=main&event=workflow_dispatch&status=in_progress`,
    {
      headers,
    }
  );

  if (!response.ok) {
    console.error("GitHub API error:", response.status, response.statusText);
    return { hasRunningWorkflow: false };
  }

  const data = await response.json();
  const runningWorkflows = data.workflow_runs || [];

  const agentCreationWorkflows = runningWorkflows.filter(
    (run: WorkflowRun) =>
      run.path === ".github/workflows/create-agent.yaml" &&
      run.status === "in_progress"
  );

  if (agentCreationWorkflows.length > 0) {
    const latestWorkflow = agentCreationWorkflows[0];
    return {
      hasRunningWorkflow: true,
      workflowRunId: latestWorkflow.id,
      createdAt: latestWorkflow.created_at,
      htmlUrl: latestWorkflow.html_url,
    };
  }

  return { hasRunningWorkflow: false };
}

export const GET = withApiWrapper(checkWorkflowStatusHandler);
