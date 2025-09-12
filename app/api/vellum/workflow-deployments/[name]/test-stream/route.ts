import { NextRequest } from "next/server";
import { VellumClient } from "vellum-ai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "VELLUM_API_KEY environment variable is required",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: unknown) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        let executionId: string | null = null;

        try {
          const workflowStream = await vellumClient.executeWorkflowStream({
            workflowDeploymentName: name,
            inputs: [],
            metadata: {
              environment: process.env.AGENT_ENVIRONMENT || "unknown",
            },
          });
          let workflowOutputs: unknown = null;

          for await (const event of workflowStream) {
            if (!executionId && event.executionId) {
              executionId = event.executionId;
              sendEvent("workflow-initiated", {
                executionId,
                message: `Workflow ${name} initiated`,
              });
            }

            sendEvent("workflow-event", {
              type: event.type,
              executionId: event.executionId,
              data: event.data,
            });

            if (event.type === "WORKFLOW") {
              if (event.data.error) {
                sendEvent("workflow-error", {
                  executionId: event.executionId,
                  error: event.data.error.message,
                  message: `Workflow ${name} failed`,
                });
                break;
              }

              if (event.data.state === "FULFILLED" && event.data.outputs) {
                workflowOutputs = event.data.outputs;
                sendEvent("workflow-completed", {
                  executionId: event.executionId,
                  outputs: workflowOutputs,
                  message: `Workflow ${name} completed successfully`,
                });
                break;
              }
            }
          }
        } catch (error) {
          sendEvent("workflow-error", {
            executionId,
            error: error instanceof Error ? error.message : "Unknown error",
            message: `Failed to execute workflow ${name}`,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to start workflow test",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
