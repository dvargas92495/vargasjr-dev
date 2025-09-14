import {
  InboxesTable,
  InboxMessagesTable,
  ContactsTable,
  InboxMessageOperationsTable,
  type Inbox,
} from "@/db/schema";
import { desc, or, eq, inArray, sql } from "drizzle-orm";
import InboxRow from "@/components/inbox-row";
import MessageCard from "@/components/message-card";
import PaginationControls from "@/components/pagination-controls";
import Link from "next/link";
import { getDb } from "@/db/connection";

export const dynamic = "force-dynamic";

export default async function InboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const db = getDb();
  let allInboxes: Inbox[] = [];
  let recentMessages: Array<{
    id: string;
    source: string;
    displayName: string | null;
    fullName: string | null;
    createdAt: Date;
    body: string;
    inboxId: string;
    inboxName: string | null;
    inboxDisplayName: string | null;
  }> = [];
  let statuses: Record<string, string> = {};
  let error: string | null = null;
  let currentPage = 1;
  let totalPages = 1;

  try {
    const params = await searchParams;
    currentPage = parseInt((params.page as string) || "1", 10);
    const pageSize = 10;
    const offset = (currentPage - 1) * pageSize;

    allInboxes = await db
      .select()
      .from(InboxesTable)
      .orderBy(desc(InboxesTable.createdAt));

    const totalMessagesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(InboxMessagesTable);
    const totalMessages = totalMessagesResult[0]?.count || 0;
    totalPages = Math.ceil(totalMessages / pageSize);

    recentMessages = await db
      .selectDistinctOn([InboxMessagesTable.id, InboxMessagesTable.createdAt], {
        id: InboxMessagesTable.id,
        source: InboxMessagesTable.source,
        displayName: ContactsTable.slackDisplayName,
        fullName: ContactsTable.fullName,
        createdAt: InboxMessagesTable.createdAt,
        body: InboxMessagesTable.body,
        inboxId: InboxMessagesTable.inboxId,
        inboxName: InboxesTable.displayLabel,
        inboxDisplayName: InboxesTable.name,
      })
      .from(InboxMessagesTable)
      .leftJoin(
        ContactsTable,
        or(
          eq(InboxMessagesTable.source, ContactsTable.slackId),
          eq(InboxMessagesTable.source, ContactsTable.email)
        )
      )
      .leftJoin(InboxesTable, eq(InboxMessagesTable.inboxId, InboxesTable.id))
      .orderBy(desc(InboxMessagesTable.createdAt), InboxMessagesTable.id)
      .limit(pageSize)
      .offset(offset);

    const messageOperations = await db
      .select()
      .from(InboxMessageOperationsTable)
      .where(
        inArray(
          InboxMessageOperationsTable.inboxMessageId,
          recentMessages.map((message) => message.id)
        )
      );

    statuses = Object.fromEntries(
      messageOperations.map(({ inboxMessageId, operation }) => [
        inboxMessageId,
        operation,
      ])
    );
  } catch (err) {
    console.error("Error fetching inboxes:", err);
    if (
      err instanceof Error &&
      err.message.includes("relation") &&
      err.message.includes("does not exist")
    ) {
      error =
        "Database tables are being initialized. Please try again in a moment.";
    } else {
      error = "Unable to load inboxes at this time. Please try again later.";
    }
    recentMessages = [];
    statuses = {};
  }

  if (error) {
    return (
      <>
        <div className="flex-1">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Inboxes Temporarily Unavailable
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-4">
          <Link
            href="/admin/inboxes/new"
            className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            New Inbox
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500 text-white">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">Created At</th>
              <th className="px-6 py-3 border-b text-left">Type</th>
            </tr>
          </thead>
          <tbody>
            {allInboxes.map((inbox) => (
              <InboxRow key={inbox.id} inbox={inbox} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Messages Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Messages</h2>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl="/admin/inboxes"
          />
        </div>
        {recentMessages.length > 0 ? (
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={{
                  ...message,
                  source:
                    message.displayName || message.fullName || message.source,
                }}
                status={statuses[message.id] || "Unread"}
                inboxId={message.inboxId}
                inboxName={message.inboxName}
              />
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
            No recent messages found.
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4">
        <Link
          href="/admin/inboxes/new"
          className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          New Inbox
        </Link>
      </div>
    </>
  );
}
