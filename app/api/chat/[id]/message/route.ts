import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { addInboxMessage } from "@/server";
import { NotFoundError } from "@/server/errors";
import { ChatSessionsTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

async function chatMessageHandler(
  body: unknown,
  request: Request,
  context?: unknown
) {
  const params = await (context as { params: Promise<{ id: string }> }).params;
  const { id } = params;
  
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
    throw new NotFoundError("Chat session not found");
  }

  const session = chatSession[0];

  await addInboxMessage({
    body: message,
    inboxName: "chat-sessions",
    contactId: session.contactId,
    threadId: id,
  });

  return { success: true };
}

export const POST = withApiWrapper(chatMessageHandler);
