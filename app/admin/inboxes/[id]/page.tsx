import {
  InboxMessageOperationsTable,
  InboxMessagesTable,
  InboxesTable,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/connection";

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
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-500">
            <th className="px-6 py-3 border-b text-left">ID</th>
            <th className="px-6 py-3 border-b text-left">Source</th>
            <th className="px-6 py-3 border-b text-left">Created At</th>
            <th className="px-6 py-3 border-b text-left">Content</th>
            <th className="px-6 py-3 border-b text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => (
            <tr
              key={message.id}
              className="hover:bg-gray-50 hover:cursor-pointer hover:text-black"
            >
              <td className="px-6 py-4 border-b">
                <Link href={`/admin/inboxes/${id}/messages/${message.id}`}>
                  {message.id}
                </Link>
              </td>
              <td className="px-6 py-4 border-b">{message.source}</td>
              <td className="px-6 py-4 border-b">
                {message.createdAt.toLocaleString()}
              </td>
              <td className="px-6 py-4 border-b">
                {message.body.slice(0, 25)}
                {message.body.length > 25 ? "..." : ""}
              </td>
              <td className="px-6 py-4 border-b">
                {statuses[message.id] || "Unread"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
