import { NextRequest } from "next/server";
import { getDb } from "@/db/connection";
import { RoutineJobsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { VellumClient } from "vellum-ai";
import { getEnvironmentPrefix, getPRNumber } from "../../constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const routineJob = await db
      .select()
      .from(RoutineJobsTable)
      .where(eq(RoutineJobsTable.id, id))
      .then((results) => results[0]);

    if (!routineJob) {
      return new Response(
        JSON.stringify({
          error: "Routine job not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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
            workflowDeploymentName: routineJob.name,
            inputs: [],
            metadata: {
              environment: getEnvironmentPrefix(),
              pr_number: await getPRNumber(),
            },
          });
          let workflowOutputs: unknown = null;

          for await (const event of workflowStream) {
            if (!executionId && event.executionId) {
              executionId = event.executionId;
              sendEvent("workflow-initiated", {
                executionId,
                message: `Workflow ${routineJob.name} initiated`,
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
                  message: `Workflow ${routineJob.name} failed`,
                });
                break;
              }

              if (event.data.state === "FULFILLED" && event.data.outputs) {
                workflowOutputs = event.data.outputs;
                sendEvent("workflow-completed", {
                  executionId: event.executionId,
                  outputs: workflowOutputs,
                  message: `Workflow ${routineJob.name} completed successfully`,
                });
                break;
              }
            }
          }
        } catch (error) {
          sendEvent("workflow-error", {
            executionId,
            error: error instanceof Error ? error.message : "Unknown error",
            message: `Failed to execute workflow ${routineJob.name}`,
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
