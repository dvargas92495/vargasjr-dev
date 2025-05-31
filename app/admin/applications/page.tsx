import { ApplicationsTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import ApplicationRow from "@/components/application-row";
import Link from "next/link";

const db = drizzle(sql);

export default async function ApplicationsPage() {
  const allApplications = await db
    .select()
    .from(ApplicationsTable)
    .orderBy(desc(ApplicationsTable.createdAt));

  return (
    <>
      <div className="flex-1">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">API Endpoint</th>
              <th className="px-6 py-3 border-b text-left">OAuth Status</th>
              <th className="px-6 py-3 border-b text-left">OAuth Provider</th>
              <th className="px-6 py-3 border-b text-left">Created At</th>
            </tr>
          </thead>
          <tbody>
            {allApplications.map((application) => (
              <ApplicationRow key={application.id} application={application} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Link
          href="/admin/applications/new"
          className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          New Application
        </Link>
      </div>
    </>
  );
}
