import { NextResponse } from "next/server";
import { ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, id))
      .then((results) => results[0]);

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...contact,
      createdAt: contact.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch contact",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
