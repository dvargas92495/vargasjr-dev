"use server";

import { revalidatePath } from "next/cache";
import { addInboxMessage } from "@/server";
import { ChatSessionsTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export async function sendChatMessage(sessionId: string, formData: FormData) {
  const message = formData.get("message") as string;
  
  if (!message || message.trim().length === 0) {
    throw new Error("Message cannot be empty");
  }

  const db = getDb();
  const chatSession = await db
    .select({
      id: ChatSessionsTable.id,
      contactEmail: ContactsTable.email,
    })
    .from(ChatSessionsTable)
    .innerJoin(ContactsTable, eq(ChatSessionsTable.contactId, ContactsTable.id))
    .where(eq(ChatSessionsTable.id, sessionId))
    .limit(1);

  if (!chatSession.length) {
    throw new Error("Chat session not found");
  }

  const session = chatSession[0];

  await addInboxMessage({
    body: message.trim(),
    source: session.contactEmail || "Anonymous",
    inboxName: "chat-sessions",
    threadId: sessionId,
  });

  revalidatePath(`/chat/${sessionId}`);
}
