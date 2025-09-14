"use client";

import React from "react";
import Link from "next/link";
import type { ApplicationWorkspace } from "@/db/schema";

const WorkspaceRow = ({
  workspace,
  applicationId,
}: {
  workspace: ApplicationWorkspace;
  applicationId: string;
}) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 border-b">{workspace.name}</td>
      <td className="px-6 py-4 border-b">{workspace.workspaceId || "N/A"}</td>
      <td className="px-6 py-4 border-b">{workspace.clientId || "N/A"}</td>
      <td className="px-6 py-4 border-b">
        {workspace.createdAt.toLocaleDateString()}
      </td>
      <td className="px-6 py-4 border-b">
        <Link
          href={`/admin/applications/${applicationId}/workspaces/${workspace.id}`}
          className="text-blue-600 hover:text-blue-800 inline-block min-h-[44px] flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          View Details
        </Link>
      </td>
    </tr>
  );
};

export default WorkspaceRow;
