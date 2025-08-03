import {
  InboxMessageOperationsTable,
  InboxMessagesTable,
  InboxesTable,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import MessageCard from "@/components/message-card";

// params will contain the dynamic [id] value
export default async function InboxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const inbox = await db
    .select()
    .from(InboxesTable)
    .where(eq(InboxesTable.id, id))
    .limit(1);

  if (!inbox.length) {
    notFound();
  }

  const messages = await db
    .select({
      id: InboxMessagesTable.id,
      source: InboxMessagesTable.source,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
    })
    .from(InboxMessagesTable)
    .where(eq(InboxMessagesTable.inboxId, inbox[0].id))
    .orderBy(desc(InboxMessagesTable.createdAt))
    .limit(25);

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(
      inArray(
        InboxMessageOperationsTable.inboxMessageId,
        messages.map((message) => message.id)
      )
    );

  const statuses = Object.fromEntries(
    messageOperations.map(({ inboxMessageId, operation }) => [
      inboxMessageId,
      operation,
    ])
  );

  return (
    <div className="flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4">{inbox[0].name}</h1>
      <div className="space-y-3">
        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            status={statuses[message.id] || "Unread"}
            inboxId={id}
          />
        ))}
      </div>
    </div>
  );
}
