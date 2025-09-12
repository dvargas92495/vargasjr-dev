import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { cronExpression } = body;

    if (!cronExpression) {
      return NextResponse.json(
        { error: "cronExpression is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const existingJob = await db
      .select()
      .from(RoutineJobsTable)
      .where(eq(RoutineJobsTable.id, id))
      .limit(1);

    if (existingJob.length === 0) {
      return NextResponse.json(
        { error: "Routine job not found" },
        { status: 404 }
      );
    }

    const updatedJob = await db
      .update(RoutineJobsTable)
      .set({ cronExpression })
      .where(eq(RoutineJobsTable.id, id))
      .returning()
      .execute();

    return NextResponse.json(updatedJob[0]);
  } catch (error) {
    console.error("Failed to update routine job:", error);
    return NextResponse.json(
      {
        error: "Failed to update routine job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
