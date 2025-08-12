import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { RoutineJobExecutionsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const db = getDb();
    const executions = await db
      .select({
        id: RoutineJobExecutionsTable.id,
        executionId: RoutineJobExecutionsTable.executionId,
        outputs: RoutineJobExecutionsTable.outputs,
        createdAt: RoutineJobExecutionsTable.createdAt,
      })
      .from(RoutineJobExecutionsTable)
      .where(eq(RoutineJobExecutionsTable.routineJobId, id))
      .orderBy(desc(RoutineJobExecutionsTable.createdAt))
      .limit(10);

    const executionsWithFormattedDates = executions.map(execution => ({
      ...execution,
      createdAt: execution.createdAt.toISOString(),
    }));

    return NextResponse.json(executionsWithFormattedDates);
  } catch (error) {
    console.error("Error fetching routine job executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
