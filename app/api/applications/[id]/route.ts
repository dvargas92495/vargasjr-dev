import { NextResponse } from "next/server";
import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

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
