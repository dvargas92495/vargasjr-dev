import { NextRequest } from "next/server";
import { getDb } from "@/db/connection";
import { JobsTable, JobSessionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const job = await db
      .select()
      .from(JobsTable)
      .where(eq(JobsTable.id, id))
      .then((results) => results[0]);

    if (!job) {
      return new Response("Job not found", { status: 404 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (event: string, data: unknown) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        let sessionId: string | null = null;

        try {
          sendEvent('job-initiated', {
            message: `Starting test for job '${job.name}'`
          });

          const newJobSession = await db
            .insert(JobSessionsTable)
            .values({
              jobId: job.id,
            })
            .returning()
            .execute();

          sessionId = newJobSession[0].id;

          sendEvent('job-event', {
            type: 'SESSION_CREATED',
            sessionId: sessionId,
            data: { jobId: job.id }
          });

          sendEvent('job-completed', {
            sessionId: sessionId,
            message: `Job session created successfully for job '${job.name}'`
          });

        } catch (error) {
          sendEvent('job-error', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: `Failed to create job session for job '${job.name}'`
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: "Failed to start job test", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
