import { NextResponse } from "next/server";
import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { z, ZodError } from "zod";

const updateApplicationSchema = z.object({
  name: z.string().optional(),
  clientId: z.string().trim().optional(),
  clientSecret: z.string().trim().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const application = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .then((results) => results[0]);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch application",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData = updateApplicationSchema.parse(body);

    const db = getDb();

    const application = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .then((results) => results[0]);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (application.appType === "TWILIO" && updateData.clientId) {
      const twilioAccountSidRegex = /^AC[0-9a-fA-F]{32}$/;
      if (!twilioAccountSidRegex.test(updateData.clientId)) {
        return NextResponse.json(
          {
            error: "Invalid Twilio Account SID",
            details: "Twilio Account SID must start with 'AC' (uppercase) followed by 32 hexadecimal characters",
          },
          { status: 400 }
        );
      }
    }

    await db
      .update(ApplicationsTable)
      .set(updateData)
      .where(eq(ApplicationsTable.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating application:", error);
    return NextResponse.json(
      {
        error: "Failed to update application",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const application = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .then((results) => results[0]);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    await db
      .delete(ApplicationWorkspacesTable)
      .where(eq(ApplicationWorkspacesTable.applicationId, id));

    await db.delete(ApplicationsTable).where(eq(ApplicationsTable.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting application:", error);
    return NextResponse.json(
      {
        error: "Failed to delete application",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
