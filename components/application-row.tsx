"use client";

import type { Application } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const ApplicationRow = ({ application }: { application: Application }) => {
  const router = useRouter();
  const handleClick = useCallback(() => {
    router.push(`/admin/applications/${application.id}`);
  }, [router, application.id]);

  return (
    <tr
      key={application.id}
      className="hover:bg-gray-50 hover:cursor-pointer hover:text-black"
      onClick={handleClick}
    >
      <td className="px-6 py-4 border-b">{application.name}</td>
      <td className="px-6 py-4 border-b">
        {application.createdAt.toLocaleDateString()}
      </td>
    </tr>
  );
};

export default ApplicationRow;
