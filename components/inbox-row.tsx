"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "N/A";
  try {
    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString();
  } catch {
    return "Invalid date";
  }
}

const InboxRow = ({
  inbox,
}: {
  inbox: {
    id: string;
    name: string;
    displayLabel: string | null;
    createdAt: string;
    type: string;
    lastMessageDate: string | null;
  };
}) => {
  const router = useRouter();
  const handleClick = useCallback(() => {
    router.push(`/admin/inboxes/${inbox.id}`);
  }, [router, inbox.id]);
  return (
    <tr
      key={inbox.id}
      className="hover:bg-gray-50 hover:cursor-pointer hover:text-black"
      onClick={handleClick}
    >
      <td className="px-6 py-4 border-b">{inbox.displayLabel || inbox.name}</td>
      <td className="px-6 py-4 border-b">{formatDate(inbox.createdAt)}</td>
      <td className="px-6 py-4 border-b">
        {inbox.lastMessageDate
          ? formatDate(inbox.lastMessageDate)
          : "No messages"}
      </td>
      <td className="px-6 py-4 border-b">{inbox.type}</td>
    </tr>
  );
};

export default InboxRow;
