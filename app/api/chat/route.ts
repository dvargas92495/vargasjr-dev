import { z } from "zod";
import { ChatSessionsTable, InboxesTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createContactWithValidation, InvalidContactDataError } from "@/server";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";

async function createChatSessionHandler(body: unknown) {
  const { email } = z
    .object({
      email: z.string().email(),
      message: z.string(),
    })
    .parse(body);

  const db = getDb();
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
    try {
      const newContact = await createContactWithValidation({ email });
      contact = [newContact];
    } catch (error) {
      if (error instanceof InvalidContactDataError) {
        throw new Error("Cannot create chat session: no identifying information provided");
      }
      throw error;
    }
  }

  const chatSession = await db
    .insert(ChatSessionsTable)
    .values({
      inboxId: inbox[0].id,
      contactId: contact[0].id,
    })
    .returning({ id: ChatSessionsTable.id });

  return { id: chatSession[0].id };
}

export const POST = withApiWrapper(createChatSessionHandler);
