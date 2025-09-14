"use client";

import React from "react";
import type { ApplicationWorkspace } from "@/db/schema";

const WorkspaceRow = ({ workspace }: { workspace: ApplicationWorkspace }) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 border-b">{workspace.name}</td>
      <td className="px-6 py-4 border-b">{workspace.workspaceId || "N/A"}</td>
      <td className="px-6 py-4 border-b">{workspace.clientId || "N/A"}</td>
      <td className="px-6 py-4 border-b">
        {workspace.createdAt.toLocaleDateString()}
      </td>
    </tr>
  );
};

export default WorkspaceRow;
