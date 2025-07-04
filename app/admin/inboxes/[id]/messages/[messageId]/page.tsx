import {
  InboxMessageOperationsTable,
  InboxMessagesTable,
  OutboxMessagesTable,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import DeleteMessageButton from "@/components/delete-message-button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getDb } from "@/db/connection";

export default async function InboxMessage({
  params,
}: {
  params: Promise<{ messageId: string; id: string }>;
}) {
  const { messageId, id: inboxId } = await params;

  const db = getDb();
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

  const messageResponses = await db
    .select()
    .from(OutboxMessagesTable)
    .where(eq(OutboxMessagesTable.parentInboxMessageId, message.id));

  return (
    <div className="flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/inboxes/${inboxId}`}>
            <button className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold">Message</h1>
        </div>
        <DeleteMessageButton messageId={message.id} />
      </div>

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
      {messageResponses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Responses</h2>

          <div className="space-y-4">
            {messageResponses.map((response) => (
              <details
                key={response.id}
                className="bg-gray-800 rounded-lg shadow cursor-pointer group"
              >
                <summary className="px-6 py-4 flex items-center justify-between hover:bg-gray-700">
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-300 text-sm">
                      {response.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>

                <div className="px-6 py-4 border-t border-gray-700">
                  <div className="text-sm text-gray-300">Response</div>
                  <div className="mt-2 p-4 bg-gray-700 rounded whitespace-pre-wrap text-white">
                    {response.body.substring(0, 50)}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
