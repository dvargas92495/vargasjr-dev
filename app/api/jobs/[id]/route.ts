import { NextResponse } from "next/server";
import { JobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const job = await db
      .select()
      .from(JobsTable)
      .where(eq(JobsTable.id, id))
      .then((results) => results[0]);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const jobWithLabel = {
      ...job,
      priority: convertPriorityToLabel(job.priority),
    };

    return NextResponse.json(jobWithLabel);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch job", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
