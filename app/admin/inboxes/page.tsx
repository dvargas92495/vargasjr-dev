import {
  InboxesTable,
  InboxMessagesTable,
  ContactsTable,
  InboxMessageOperationsTable,
  type Inbox,
} from "@/db/schema";
import { desc, eq, inArray, max, sql, isNull, ne, or } from "drizzle-orm";
import InboxRow from "@/components/inbox-row";
import RecentMessagesSection from "@/components/recent-messages-section";
import Link from "next/link";
import { getDb } from "@/db/connection";
import { OWN_EMAILS } from "@/app/lib/constants";

export const dynamic = "force-dynamic";

export default async function InboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const db = getDb();
  let allInboxes: Array<Inbox & { lastMessageDate: Date | null }> = [];
  let recentMessages: Array<{
    id: string;
    displayName: string | null;
    fullName: string | null;
    email: string | null;
    createdAt: Date;
    latestOperationAt: Date | null;
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
      .select({
        id: InboxesTable.id,
        name: InboxesTable.name,
        displayLabel: InboxesTable.displayLabel,
        createdAt: InboxesTable.createdAt,
        type: InboxesTable.type,
        config: InboxesTable.config,
        lastMessageDate: max(InboxMessagesTable.createdAt),
      })
      .from(InboxesTable)
      .leftJoin(
        InboxMessagesTable,
        eq(InboxesTable.id, InboxMessagesTable.inboxId)
      )
      .groupBy(InboxesTable.id)
      .orderBy(
        desc(
          sql`COALESCE(${max(
            InboxMessagesTable.createdAt
          )}, '1970-01-01'::timestamp)`
        ),
        desc(InboxesTable.createdAt)
      );

    const latestOperations = db
      .selectDistinctOn([InboxMessageOperationsTable.inboxMessageId], {
        inboxMessageId: InboxMessageOperationsTable.inboxMessageId,
        operation: InboxMessageOperationsTable.operation,
        createdAt: InboxMessageOperationsTable.createdAt,
      })
      .from(InboxMessageOperationsTable)
      .orderBy(
        InboxMessageOperationsTable.inboxMessageId,
        desc(InboxMessageOperationsTable.createdAt)
      )
      .as("latestOperations");

    const totalMessagesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(InboxMessagesTable)
      .leftJoin(
        latestOperations,
        eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
      )
      .where(
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      );
    const totalMessages = totalMessagesResult[0]?.count || 0;
    totalPages = Math.ceil(totalMessages / pageSize);

    const allRecentMessages = await db
      .selectDistinctOn([InboxMessagesTable.id], {
        id: InboxMessagesTable.id,
        displayName: ContactsTable.slackDisplayName,
        fullName: ContactsTable.fullName,
        email: ContactsTable.email,
        createdAt: InboxMessagesTable.createdAt,
        latestOperationAt: latestOperations.createdAt,
        body: InboxMessagesTable.body,
        inboxId: InboxMessagesTable.inboxId,
        inboxName: InboxesTable.displayLabel,
        inboxDisplayName: InboxesTable.name,
      })
      .from(InboxMessagesTable)
      .leftJoin(
        ContactsTable,
        eq(InboxMessagesTable.contactId, ContactsTable.id)
      )
      .leftJoin(InboxesTable, eq(InboxMessagesTable.inboxId, InboxesTable.id))
      .leftJoin(
        latestOperations,
        eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
      )
      .where(
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      )
      .orderBy(
        InboxMessagesTable.id,
        desc(
          sql`COALESCE(${latestOperations.createdAt}, ${InboxMessagesTable.createdAt})`
        )
      )
      .limit(pageSize)
      .offset(offset);

    recentMessages = allRecentMessages.filter((message) => {
      if (!message.email) return true;
      const emailLower = message.email.toLowerCase();
      return !OWN_EMAILS.some((ownEmail) =>
        emailLower.includes(ownEmail.toLowerCase())
      );
    });

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
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Inboxes</h1>
          <Link
            href="/admin/inboxes/new"
            className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            New Inbox
          </Link>
        </div>

        <div>
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
      </>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inboxes</h1>
        <Link
          href="/admin/inboxes/new"
          className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          New Inbox
        </Link>
      </div>

      <div>
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500 text-white">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">Created At</th>
              <th className="px-6 py-3 border-b text-left">
                Last Message Date
              </th>
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

      <RecentMessagesSection
        recentMessages={recentMessages}
        statuses={statuses}
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </>
  );
}
