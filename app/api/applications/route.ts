import { NextResponse } from "next/server";
import { ApplicationsTable } from "@/db/schema";
import { z, ZodError } from "zod";
import { getDb } from "@/db/connection";

const applicationSchema = z.object({
  name: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  apiEndpoint: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, clientId, clientSecret, apiEndpoint } = applicationSchema.parse(body);

    const db = getDb();
    const [application] = await db
      .insert(ApplicationsTable)
      .values({ name, clientId, clientSecret, apiEndpoint })
      .returning({ id: ApplicationsTable.id });

    return NextResponse.json({ id: application.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
}
