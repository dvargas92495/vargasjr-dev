import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { RoutineJobsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { VellumClient } from "vellum-ai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const db = getDb();
    const routineJob = await db
      .select({ name: RoutineJobsTable.name })
      .from(RoutineJobsTable)
      .where(eq(RoutineJobsTable.id, id))
      .limit(1);

    if (routineJob.length === 0) {
      return NextResponse.json(
        { error: "Routine job not found" },
        { status: 404 }
      );
    }

    const workflowDeploymentName = routineJob[0].name;

    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VELLUM_API_KEY not configured" },
        { status: 500 }
      );
    }

    const vellumClient = new VellumClient({ apiKey });

    const deployments = await vellumClient.workflowDeployments.list();
    const deployment = deployments.results?.find(
      (d) => d.name === workflowDeploymentName
    );

    if (!deployment) {
      return NextResponse.json(
        { error: "Workflow deployment not found" },
        { status: 404 }
      );
    }

    const executions =
      await vellumClient.workflowDeployments.listWorkflowDeploymentEventExecutions(
        deployment.id,
        { limit: 10 }
      );

    const transformedExecutions =
      executions.results?.map((execution) => ({
        id: execution.spanId,
        executionId: execution.spanId,
        createdAt: execution.start,
        outputs: execution.outputs,
        error: execution.error,
        environment:
          execution.parentContext?.type === "WORKFLOW_RELEASE_TAG"
            ? execution.parentContext.metadata?.environment
            : "unknown",
      })) || [];

    return NextResponse.json(transformedExecutions);
  } catch (error) {
    console.error("Error fetching routine job executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
