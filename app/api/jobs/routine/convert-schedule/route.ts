import { NextResponse } from "next/server";
import { VellumClient } from "vellum-ai";
import { getEnvironmentMetadata } from "../../../constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scheduleDescription } = body;

    if (!scheduleDescription) {
      return NextResponse.json(
        { error: "scheduleDescription is required" },
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

    try {
      const response = await vellumClient.executeWorkflow({
        workflowDeploymentName: "schedule-to-cron",
        inputs: [
          {
            name: "schedule_description",
            value: scheduleDescription,
            type: "STRING",
          },
        ],
        metadata: {
          environment: await getEnvironmentMetadata(),
        },
      });

      if (response.data.state !== "FULFILLED") {
        let errorMessage = "Workflow execution failed";
        if (response.data.error) {
          const errorParts: string[] = [];
          if (response.data.error.message) {
            errorParts.push(response.data.error.message);
          }
          if (response.data.error.code) {
            errorParts.push(`(Code: ${response.data.error.code})`);
          }
          if (errorParts.length > 0) {
            errorMessage = `Workflow execution failed: ${errorParts.join(" ")}`;
          }
        }
        throw new Error(errorMessage);
      }

      if (!response.data.outputs) {
        console.error(
          "Workflow returned no outputs. Full response:",
          JSON.stringify(response.data, null, 2)
        );
        return NextResponse.json(
          {
            error: "Workflow execution failed or returned no outputs",
            details: "No outputs returned from workflow",
            fullResponse: response.data,
          },
          { status: 500 }
        );
      }

      const cronOutput = response.data.outputs.find(
        (output) => output.name === "cron_expression"
      );
      if (!cronOutput || typeof cronOutput.value !== "string") {
        throw new Error(
          "Failed to generate cron expression from natural language"
        );
      }

      return NextResponse.json({ cronExpression: cronOutput.value });
    } catch (error) {
      console.error("Failed to convert schedule description to cron:", error);
      const userMessage =
        error instanceof Error &&
        error.message.includes("Failed to generate cron expression")
          ? 'Unable to understand the schedule description. Please try a clearer format like "every Monday at 5pm" or "daily at 9am"'
          : "Failed to convert schedule description to cron expression";
      return NextResponse.json(
        {
          error: userMessage,
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to process schedule conversion:", error);
    return NextResponse.json(
      {
        error: "Failed to process schedule conversion",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
