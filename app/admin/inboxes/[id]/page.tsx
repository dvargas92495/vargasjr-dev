import {
  InboxMessageOperationsTable,
  InboxMessagesTable,
  InboxesTable,
  ContactsTable,
} from "@/db/schema";
import { desc, eq, inArray, max, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MessageCard from "@/components/message-card";
import DeleteInboxButton from "@/components/delete-inbox-button";
import { OWN_EMAIL } from "@/app/lib/constants";

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

  const latestOperations = db
    .select({
      inboxMessageId: InboxMessageOperationsTable.inboxMessageId,
      latestOperationTime: max(InboxMessageOperationsTable.createdAt).as(
        "latest_operation_time"
      ),
    })
    .from(InboxMessageOperationsTable)
    .groupBy(InboxMessageOperationsTable.inboxMessageId)
    .as("latest_operations");

  const allMessages = await db
    .select({
      id: InboxMessagesTable.id,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      email: ContactsTable.email,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
      latestOperationTime: latestOperations.latestOperationTime,
    })
    .from(InboxMessagesTable)
    .leftJoin(ContactsTable, eq(InboxMessagesTable.contactId, ContactsTable.id))
    .leftJoin(
      latestOperations,
      eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
    )
    .where(eq(InboxMessagesTable.inboxId, inbox[0].id))
    .orderBy(
      desc(
        sql`coalesce(${latestOperations.latestOperationTime}::timestamptz, ${InboxMessagesTable.createdAt}::timestamptz)`
      ),
      InboxMessagesTable.id
    )
    .limit(25);

  const messages = allMessages.filter((message) => {
    if (!message.email) return true;
    const emailLower = message.email.toLowerCase();
    return !emailLower.includes(OWN_EMAIL.toLowerCase());
  });

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(
      inArray(
        InboxMessageOperationsTable.inboxMessageId,
        messages.map((message) => message.id)
      )
    );

  const operationsByMessage = messageOperations.reduce((acc, op) => {
    if (!acc[op.inboxMessageId]) {
      acc[op.inboxMessageId] = [];
    }
    acc[op.inboxMessageId].push(op);
    return acc;
  }, {} as Record<string, typeof messageOperations>);

  const statuses = Object.fromEntries(
    messages.map((message) => {
      const ops = operationsByMessage[message.id] || [];
      const latestOp = ops.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      return [message.id, latestOp?.operation || "UNREAD"];
    })
  );

  return (
    <div className="flex flex-col p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/inboxes">
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold">
          {inbox[0].displayLabel || inbox[0].name}
        </h1>
        <Link href={`/admin/inboxes/${id}/edit`}>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Edit
          </button>
        </Link>
        <DeleteInboxButton inboxId={id} />
      </div>
      <div className="space-y-3">
        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={{
              ...message,
              source:
                message.displayName ||
                message.fullName ||
                message.email ||
                "Unknown",
            }}
            status={statuses[message.id] || "UNREAD"}
            inboxId={id}
          />
        ))}
      </div>
    </div>
  );
}
