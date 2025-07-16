import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, cronExpression } = body;

    if (!name || !cronExpression) {
      return NextResponse.json(
        { error: "Name and cronExpression are required" },
        { status: 400 }
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
