import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../lib/github-auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ hasRunningWorkflow: false });
    }

    const data = await response.json();
    const runningWorkflows = data.workflow_runs || [];

    const agentCreationWorkflows = runningWorkflows.filter(
      (run: {
        path: string;
        status: string;
        id: number;
        created_at: string;
        html_url: string;
      }) =>
        run.path === ".github/workflows/ci.yaml" && run.status === "in_progress"
    );

    if (agentCreationWorkflows.length > 0) {
      const latestWorkflow = agentCreationWorkflows[0];
      return NextResponse.json({
        hasRunningWorkflow: true,
        workflowRunId: latestWorkflow.id,
        createdAt: latestWorkflow.created_at,
        htmlUrl: latestWorkflow.html_url,
      });
    }

    return NextResponse.json({ hasRunningWorkflow: false });
  } catch (error) {
    console.error("Workflow status check error:", error);
    return NextResponse.json({ hasRunningWorkflow: false });
  }
}
