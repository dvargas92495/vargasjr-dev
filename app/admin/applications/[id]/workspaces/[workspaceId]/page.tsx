import { ApplicationWorkspacesTable, ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string; workspaceId: string }>;
}) {
  const { id, workspaceId } = await params;
  const db = getDb();
  
  const [workspace, application] = await Promise.all([
    db
      .select()
      .from(ApplicationWorkspacesTable)
      .where(eq(ApplicationWorkspacesTable.id, workspaceId))
      .then((results) => results[0]),
    db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .then((results) => results[0])
  ]);

  if (!workspace || !application || workspace.applicationId !== id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/applications/${id}`}>
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h2 className="text-xl font-bold">Workspace Details</h2>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900">{workspace.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Workspace ID
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.workspaceId || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Client ID
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.clientId || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Client Secret
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.clientSecret ? "••••••••" : "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Access Token
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.accessToken ? "••••••••" : "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Refresh Token
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.refreshToken ? "••••••••" : "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {workspace.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
