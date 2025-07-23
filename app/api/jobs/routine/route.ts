import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { VellumClient } from 'vellum-ai';

export async function GET() {
  try {
    const db = getDb();
    const routineJobs = await db.select().from(RoutineJobsTable);
    return NextResponse.json(routineJobs);
  } catch (error) {
    console.error("Failed to fetch routine jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch routine jobs", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, scheduleDescription } = body;

    if (!name || !scheduleDescription) {
      return NextResponse.json(
        { error: "Name and scheduleDescription are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VELLUM_API_KEY environment variable is required" },
        { status: 500 }
      );
    }

    const vellumClient = new VellumClient({ apiKey });

    let cronExpression: string;
    try {
      const response = await vellumClient.executeWorkflow({
        workflowDeploymentName: "workflows.schedule_to_cron",
        inputs: [
          {
            name: "schedule_description",
            value: scheduleDescription,
            type: "STRING"
          }
        ],
      });

      if (response.data.state !== 'FULFILLED' || !response.data.outputs) {
        throw new Error('Workflow execution failed or returned no outputs');
      }

      const cronOutput = response.data.outputs.find((output) => output.name === 'cron_expression');
      if (!cronOutput || typeof cronOutput.value !== 'string') {
        throw new Error('Failed to generate cron expression from natural language');
      }

      cronExpression = cronOutput.value;
    } catch (error) {
      console.error("Failed to convert schedule description to cron:", error);
      return NextResponse.json(
        { error: "Failed to convert schedule description to cron expression", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }

    const db = getDb();
    const newRoutineJob = await db
      .insert(RoutineJobsTable)
      .values({
        name,
        cronExpression,
        enabled: true,
      })
      .returning()
      .execute();

    return NextResponse.json(newRoutineJob[0]);
  } catch (error) {
    console.error("Failed to create routine job:", error);
    return NextResponse.json(
      { error: "Failed to create routine job", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
