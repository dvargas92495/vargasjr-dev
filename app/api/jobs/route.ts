import { NextResponse } from "next/server";
import { JobsTable } from "@/db/schema";
import { z, ZodError } from "zod";
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

const jobSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().transform(str => new Date(str)),
  priority: z.union([
    z.number().min(0).max(1),
    z.enum(['High', 'Medium', 'Low']).transform(label => {
      switch (label) {
        case 'High': return 0.8;
        case 'Medium': return 0.6;
        case 'Low': return 0.2;
        default: return 0.5;
      }
    })
  ]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, dueDate, priority } = jobSchema.parse(body);

    const db = getDb();
    const [job] = await db
      .insert(JobsTable)
      .values({ name, description, dueDate, priority })
      .returning({ id: JobsTable.id });

    return NextResponse.json({ id: job.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create job", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
