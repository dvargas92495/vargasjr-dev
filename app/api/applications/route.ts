import { NextResponse } from "next/server";
import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { z, ZodError } from "zod";
import { getDb } from "@/db/connection";

const applicationSchema = z.object({
  name: z.string(),
  appType: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, appType, clientId, clientSecret, accessToken, refreshToken } =
      applicationSchema.parse(body);

    const db = getDb();

    const [application] = await db
      .insert(ApplicationsTable)
      .values({ name, clientId, clientSecret })
      .returning({ id: ApplicationsTable.id });

    if (appType === "TWITTER" && (accessToken || refreshToken)) {
      await db.insert(ApplicationWorkspacesTable).values({
        applicationId: application.id,
        name: `${name} Workspace`,
        clientId,
        clientSecret,
        accessToken,
        refreshToken,
      });
    }

    return NextResponse.json({ id: application.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create application",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
