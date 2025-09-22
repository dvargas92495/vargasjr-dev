import { NextRequest, NextResponse } from "next/server";
import { VellumClient } from "vellum-ai";
import { getEnvironmentMetadata } from "../../../constants";
import { z } from "zod";

const operationSchema = z.object({
  operation: z.enum(["UNREAD", "ARCHIVED"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json();
    const { operation } = operationSchema.parse(body);

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

    const response = await vellumClient.executeWorkflow({
      workflowDeploymentName: "manual-message-operation",
      inputs: [
        {
          name: "message_id",
          value: messageId,
          type: "STRING",
        },
        {
          name: "operation",
          value: operation,
          type: "STRING",
        },
      ],
      metadata: {
        environment: await getEnvironmentMetadata(),
        location: "manual-message-operation",
      },
    });

    if (response.data.state !== "FULFILLED") {
      let errorMessage = "Workflow execution failed";
      if (response.data.error) {
        errorMessage = `Workflow execution failed: ${response.data.error.message}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      executionId: response.executionId,
      outputs: response.data.outputs,
    });
  } catch (error) {
    console.error("Failed to execute manual message operation:", error);
    return NextResponse.json(
      {
        error: "Failed to execute operation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
