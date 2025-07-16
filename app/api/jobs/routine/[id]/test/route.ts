import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { eq } from "drizzle-orm";
import { VellumClient } from 'vellum-ai';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const routineJob = await db
      .select()
      .from(RoutineJobsTable)
      .where(eq(RoutineJobsTable.id, id))
      .then((results) => results[0]);

    if (!routineJob) {
      return NextResponse.json(
        { error: "Routine job not found" },
        { status: 404 }
      );
    }

    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VELLUM_API_KEY environment variable is required" },
        { status: 500 }
      );
    }

    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    const stream = await vellumClient.executeWorkflowStream({
      workflowDeploymentName: routineJob.name,
      inputs: [],
    });

    let workflowOutputs: unknown = null;
    for await (const event of stream) {
      if (event.type === 'WORKFLOW') {
        if (event.data.error) {
          throw new Error(`Workflow ${routineJob.name} failed: ${event.data.error.message}`);
        }
        if (event.data.state === 'FULFILLED' && event.data.outputs) {
          workflowOutputs = event.data.outputs;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      outputs: workflowOutputs,
      message: `Workflow ${routineJob.name} executed successfully`
    });
  } catch (error) {
    console.error("Failed to test routine job:", error);
    return NextResponse.json(
      { error: "Failed to test routine job", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
