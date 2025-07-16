import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { eq } from "drizzle-orm";

export async function GET(
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

    return NextResponse.json(routineJob);
  } catch (error) {
    console.error("Failed to fetch routine job:", error);
    return NextResponse.json(
      { error: "Failed to fetch routine job", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
