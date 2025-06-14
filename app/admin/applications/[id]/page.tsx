import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import DeleteApplicationButton from "@/components/delete-application-button";

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
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Application Details</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <p className="mt-1 text-sm text-gray-900">{application.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Client ID</label>
          <p className="mt-1 text-sm text-gray-900">{application.clientId || 'N/A'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">API Endpoint</label>
          <p className="mt-1 text-sm text-gray-900">{application.apiEndpoint || 'N/A'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Created At</label>
          <p className="mt-1 text-sm text-gray-900">
            {application.createdAt.toLocaleDateString()}
          </p>
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
