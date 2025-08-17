import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import DeleteApplicationButton from "@/components/delete-application-button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const application = await db
    .select()
    .from(ApplicationsTable)
    .where(eq(ApplicationsTable.id, id))
    .then((results) => results[0]);

  if (!application) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/applications">
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h2 className="text-xl font-bold">Application Details</h2>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900">{application.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Client ID
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {application.clientId || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {application.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <DeleteApplicationButton
          applicationId={application.id}
          applicationName={application.name}
        />
      </div>
    </div>
  );
}
