import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import DeleteApplicationButton from "@/components/delete-application-button";
import WorkspaceRow from "@/components/workspace-row";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [application, workspaces] = await Promise.all([
    db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .then((results) => results[0]),
    db
      .select()
      .from(ApplicationWorkspacesTable)
      .where(eq(ApplicationWorkspacesTable.applicationId, id)),
  ]);

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

      {workspaces.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Workspaces</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-500 text-white">
                  <th className="px-6 py-3 border-b text-left">Name</th>
                  <th className="px-6 py-3 border-b text-left">Workspace ID</th>
                  <th className="px-6 py-3 border-b text-left">Client ID</th>
                  <th className="px-6 py-3 border-b text-left">Created At</th>
                  <th className="px-6 py-3 border-b text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <WorkspaceRow 
                    key={workspace.id} 
                    workspace={workspace} 
                    applicationId={application.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-4">
        <Link
          href={`/admin/applications/${application.id}/edit`}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
        >
          <PencilIcon className="w-4 h-4" />
          Edit Application
        </Link>
        <DeleteApplicationButton
          applicationId={application.id}
          applicationName={application.name}
        />
      </div>
    </div>
  );
}
