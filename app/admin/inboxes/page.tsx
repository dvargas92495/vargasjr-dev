import { InboxesTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import InboxRow from "@/components/inbox-row";

const db = drizzle(sql);

export default async function InboxesPage() {
  const allInboxes = await db
    .select()
    .from(InboxesTable)
    .orderBy(desc(InboxesTable.createdAt));

  return (
    <>
      <div className="flex-1">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500">
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
      <div className="mt-4">
        <a
          href="/admin/inboxes/new"
          className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          New Inbox
        </a>
      </div>
    </>
  );
}
