import {
  InboxMessageOperationsTable,
  InboxMessagesTable,
  InboxesTable,
  ContactsTable,
} from "@/db/schema";
import { desc, eq, inArray, and, isNull, ne, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MessageCard from "@/components/message-card";
import DeleteInboxButton from "@/components/delete-inbox-button";

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
    .selectDistinctOn([InboxMessagesTable.id, InboxMessagesTable.createdAt], {
      id: InboxMessagesTable.id,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      email: ContactsTable.email,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
    })
    .from(InboxMessagesTable)
    .leftJoin(ContactsTable, eq(InboxMessagesTable.contactId, ContactsTable.id))
    .leftJoin(
      InboxMessageOperationsTable,
      eq(InboxMessagesTable.id, InboxMessageOperationsTable.inboxMessageId)
    )
    .where(
      and(
        eq(InboxMessagesTable.inboxId, inbox[0].id),
        or(
          isNull(InboxMessageOperationsTable.operation),
          ne(InboxMessageOperationsTable.operation, "ARCHIVED")
        )
      )
    )
    .orderBy(desc(InboxMessagesTable.createdAt), InboxMessagesTable.id)
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
            status={statuses[message.id] || "Unread"}
            inboxId={id}
          />
        ))}
      </div>
    </div>
  );
}
