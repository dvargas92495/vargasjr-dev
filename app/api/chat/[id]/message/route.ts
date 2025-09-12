import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { addInboxMessage } from "@/server";
import { NotFoundError } from "@/server/errors";
import { ChatSessionsTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = z
      .object({
        message: z.string().min(1, "Message cannot be empty"),
      })
      .parse(body);

    const db = getDb();
    const chatSession = await db
      .select({
        id: ChatSessionsTable.id,
        contactEmail: ContactsTable.email,
        contactId: ChatSessionsTable.contactId,
      })
      .from(ChatSessionsTable)
      .innerJoin(
        ContactsTable,
        eq(ChatSessionsTable.contactId, ContactsTable.id)
      )
      .where(eq(ChatSessionsTable.id, id))
      .limit(1);

    if (!chatSession.length) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    const session = chatSession[0];

    await addInboxMessage({
      body: message,
      source: session.contactEmail || "Anonymous",
      inboxName: "chat-sessions",
      contactId: session.contactId,
      threadId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `Invalid request body: ${formatZodError(error)}` },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to send chat message", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
