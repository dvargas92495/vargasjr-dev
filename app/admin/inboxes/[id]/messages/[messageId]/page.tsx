import { InboxMessageOperationsTable, InboxMessagesTable } from "@/db/schema";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

const db = drizzle(sql);

export default async function InboxMessage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const { messageId } = await params;

  const messages = await db
    .select({
      id: InboxMessagesTable.id,
      source: InboxMessagesTable.source,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
    })
    .from(InboxMessagesTable)
    .where(eq(InboxMessagesTable.id, messageId))
    .orderBy(desc(InboxMessagesTable.createdAt))
    .limit(1);

  const message = messages[0];

  if (!message) {
    notFound();
  }

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(eq(InboxMessageOperationsTable.inboxMessageId, message.id));

  const statuses = Object.fromEntries(
    messageOperations.map(({ inboxMessageId, operation }) => [
      inboxMessageId,
      operation,
    ])
  );

  return (
    <div className="flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4">Message</h1>

      <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
        <div className="mb-4">
          <div className="text-sm text-gray-300">Source</div>
          <div className="text-lg">{message.source}</div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-300">Created At</div>
          <div className="text-lg">{message.createdAt.toLocaleString()}</div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-300">Status</div>
          <div className="text-lg">{statuses[message.id] || "Unread"}</div>
        </div>

        <div>
          <div className="text-sm text-gray-300">Message Body</div>
          <div className="mt-2 p-4 bg-gray-700 rounded whitespace-pre-wrap">
            {message.body}
          </div>
        </div>
      </div>
    </div>
  );
}
