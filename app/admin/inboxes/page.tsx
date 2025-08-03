import { InboxesTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import InboxRow from "@/components/inbox-row";
import Link from "next/link";
import { getDb } from "@/db/connection";

export default async function InboxesPage() {
  const db = getDb();
  const allInboxes = await db
    .select()
    .from(InboxesTable)
    .orderBy(desc(InboxesTable.createdAt));

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
