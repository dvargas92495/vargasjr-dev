import { InboxesTable, type Inbox } from "@/db/schema";
import { desc } from "drizzle-orm";
import InboxRow from "@/components/inbox-row";
import Link from "next/link";
import { getDb } from "@/db/connection";

export default async function InboxesPage() {
  const db = getDb();
  let allInboxes: Inbox[] = [];
  let error: string | null = null;

  try {
    allInboxes = await db
      .select()
      .from(InboxesTable)
      .orderBy(desc(InboxesTable.createdAt));
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
