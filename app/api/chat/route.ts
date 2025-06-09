import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { ChatSessionsTable, InboxesTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "@/server/errors";
import { db } from "@/db/connection";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = z
      .object({
        email: z.string().email(),
        message: z.string(),
      })
      .parse(body);

    let inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.type, "CHAT_SESSION"))
      .limit(1)
      .execute();

    if (!inbox.length) {
      const newInbox = await db
        .insert(InboxesTable)
        .values({
          name: "chat-sessions",
          type: "CHAT_SESSION",
          config: {},
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    let contact = await db
      .select({ id: ContactsTable.id })
      .from(ContactsTable)
      .where(eq(ContactsTable.email, email))
      .limit(1)
      .execute();

    if (!contact.length) {
      const newContact = await db
        .insert(ContactsTable)
        .values({ email })
        .returning({ id: ContactsTable.id });
      contact = newContact;
    }

    const chatSession = await db
      .insert(ChatSessionsTable)
      .values({ 
        inboxId: inbox[0].id,
        contactId: contact[0].id
      })
      .returning({ id: ChatSessionsTable.id });

    return NextResponse.json({ id: chatSession[0].id });
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

    console.error("Failed to create chat session", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
