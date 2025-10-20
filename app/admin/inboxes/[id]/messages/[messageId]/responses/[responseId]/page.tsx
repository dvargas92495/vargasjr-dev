import {
  OutboxMessagesTable,
  InboxMessagesTable,
  ContactsTable,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getDb } from "@/db/connection";

function formatChannelType(type: string): string {
  const typeMap: Record<string, string> = {
    EMAIL: "Email",
    SMS: "SMS",
    SLACK: "Slack",
    CHAT_SESSION: "Chat",
    FORM: "Form",
    NONE: "None",
  };
  return typeMap[type] || type;
}

export default async function OutboxMessagePage({
  params,
}: {
  params: Promise<{ responseId: string; messageId: string; id: string }>;
}) {
  const { responseId, messageId, id: inboxId } = await params;

  const db = getDb();

  const outboxMessages = await db
    .select({
      id: OutboxMessagesTable.id,
      body: OutboxMessagesTable.body,
      createdAt: OutboxMessagesTable.createdAt,
      type: OutboxMessagesTable.type,
      threadId: OutboxMessagesTable.threadId,
      parentInboxMessageId: OutboxMessagesTable.parentInboxMessageId,
    })
    .from(OutboxMessagesTable)
    .where(eq(OutboxMessagesTable.id, responseId))
    .limit(1);

  const outboxMessage = outboxMessages[0];

  if (!outboxMessage) {
    notFound();
  }

  const parentMessages = await db
    .select({
      id: InboxMessagesTable.id,
      body: InboxMessagesTable.body,
      createdAt: InboxMessagesTable.createdAt,
      contactId: InboxMessagesTable.contactId,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      email: ContactsTable.email,
    })
    .from(InboxMessagesTable)
    .leftJoin(ContactsTable, eq(InboxMessagesTable.contactId, ContactsTable.id))
    .where(eq(InboxMessagesTable.id, outboxMessage.parentInboxMessageId))
    .limit(1);

  const parentMessage = parentMessages[0];

  return (
    <div className="flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/inboxes/${inboxId}/messages/${messageId}`}>
            <button className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <PaperAirplaneIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Outgoing Message</h1>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
        <div className="mb-4">
          <div className="text-sm text-gray-300">Channel</div>
          <div className="mt-1">
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-600 text-white">
              {formatChannelType(outboxMessage.type)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-300">Sent At</div>
          <div className="text-lg">
            {outboxMessage.createdAt.toLocaleString()}
          </div>
        </div>

        {outboxMessage.threadId && (
          <div className="mb-4">
            <div className="text-sm text-gray-300">Thread ID</div>
            <div className="text-lg font-mono text-gray-400">
              {outboxMessage.threadId}
            </div>
          </div>
        )}

        {parentMessage && (
          <div className="mb-4">
            <div className="text-sm text-gray-300">In Response To</div>
            <div className="text-lg">
              <Link
                href={`/admin/inboxes/${inboxId}/messages/${parentMessage.id}`}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Message from{" "}
                {parentMessage.displayName ||
                  parentMessage.fullName ||
                  parentMessage.email ||
                  "Unknown"}
              </Link>
            </div>
          </div>
        )}

        <div>
          <div className="text-sm text-gray-300 mb-2">Message Body</div>
          <div className="p-4 bg-gray-700 rounded whitespace-pre-wrap overflow-x-auto w-full">
            {outboxMessage.body}
          </div>
        </div>
      </div>
    </div>
  );
}
