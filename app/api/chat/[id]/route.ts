import { NextResponse } from "next/server";
import {
  ChatSessionsTable,
  InboxesTable,
  ContactsTable,
  InboxMessagesTable,
} from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/db/connection";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const db = getDb();
    const chatSession = await db
      .select({
        id: ChatSessionsTable.id,
        createdAt: ChatSessionsTable.createdAt,
        inboxName: InboxesTable.name,
        contactEmail: ContactsTable.email,
        contactName: ContactsTable.fullName,
        inboxId: InboxesTable.id,
      })
      .from(ChatSessionsTable)
      .innerJoin(InboxesTable, eq(ChatSessionsTable.inboxId, InboxesTable.id))
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

    const messages = await db
      .selectDistinctOn([InboxMessagesTable.id], {
        id: InboxMessagesTable.id,
        body: InboxMessagesTable.body,
        source: InboxMessagesTable.source,
        displayName: ContactsTable.slackDisplayName,
        fullName: ContactsTable.fullName,
        createdAt: InboxMessagesTable.createdAt,
      })
      .from(InboxMessagesTable)
      .leftJoin(
        ContactsTable,
        or(
          eq(InboxMessagesTable.source, ContactsTable.slackId),
          eq(InboxMessagesTable.source, ContactsTable.email)
        )
      )
      .where(eq(InboxMessagesTable.inboxId, session.inboxId))
      .orderBy(InboxMessagesTable.createdAt);

    return NextResponse.json({
      session: {
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        inboxName: session.inboxName,
        contactEmail: session.contactEmail,
        contactName: session.contactName,
        inboxId: session.inboxId,
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        body: msg.body,
        source: msg.displayName || msg.fullName || msg.source,
        createdAt: msg.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch chat session", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
