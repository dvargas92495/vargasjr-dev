import { NextResponse } from "next/server";
import { JobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const jobs = await db
      .select({
        id: JobsTable.id,
        name: JobsTable.name,
        dueDate: JobsTable.dueDate,
        priority: JobsTable.priority,
        createdAt: JobsTable.createdAt,
      })
      .from(JobsTable)
      .orderBy(desc(JobsTable.priority));

    const jobsWithLabels = jobs.map(job => ({
      ...job,
      priority: convertPriorityToLabel(job.priority),
    }));

    return NextResponse.json(jobsWithLabels);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch jobs", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
