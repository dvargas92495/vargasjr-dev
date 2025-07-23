import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import formatZodError from "@/utils/format-zod-error";

export async function GET() {
  try {
    const db = getDb();
    const jobs = await db.select().from(RoutineJobsTable).execute();
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch routine jobs", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const createJobSchema = z.object({
  name: z.string().min(1),
  cronExpression: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, cronExpression } = createJobSchema.parse(body);

    const db = getDb();
    const [newJob] = await db
      .insert(RoutineJobsTable)
      .values({
        name,
        cronExpression,
        enabled: true,
      })
      .returning();

    return NextResponse.json({ success: true, job: newJob });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `Invalid request body: ${formatZodError(error)}` },
        { status: 400 }
      );
    }

    console.error("Failed to create routine job", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
