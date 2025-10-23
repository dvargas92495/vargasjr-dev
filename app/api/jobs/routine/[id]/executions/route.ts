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
    const { searchParams } = new URL(request.url);

    const currentPage = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 10;
    const envFilter = searchParams.get("env") || null;
    const offset = (currentPage - 1) * pageSize;

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

    const filterParam = envFilter
      ? {
          type: "LOGICAL_CONDITION_GROUP" as const,
          conditions: [
            {
              type: "LOGICAL_CONDITION" as const,
              lhs_variable: { type: "STRING" as const, value: "metadata" },
              operator: "contains" as const,
              rhs_variable: { type: "STRING" as const, value: envFilter },
            },
          ],
          combinator: "AND" as const,
          negated: false,
        }
      : undefined;

    const executions =
      await vellumClient.workflowDeployments.listWorkflowDeploymentEventExecutions(
        deployment.id,
        {
          limit: pageSize,
          offset: offset,
          ...(filterParam && { filters: JSON.stringify(filterParam) }),
        }
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
        location:
          execution.parentContext?.type === "WORKFLOW_RELEASE_TAG"
            ? execution.parentContext.metadata?.location
            : "unknown",
      })) || [];

    const totalCount = executions.count;

    return NextResponse.json({
      executions: transformedExecutions,
      totalCount: totalCount,
    });
  } catch (error) {
    console.error("Error fetching routine job executions:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error instanceof Error && error.stack ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Failed to fetch executions",
        message: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
