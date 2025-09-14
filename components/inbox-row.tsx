"use client";

import type { Inbox } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const InboxRow = ({
  inbox,
}: {
  inbox: Inbox & { lastMessageDate: Date | null };
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
      <td className="px-6 py-4 border-b">
        {inbox.createdAt.toLocaleDateString()}
      </td>
      <td className="px-6 py-4 border-b">
        {inbox.lastMessageDate
          ? inbox.lastMessageDate.toLocaleDateString()
          : "No messages"}
      </td>
      <td className="px-6 py-4 border-b">{inbox.type}</td>
    </tr>
  );
};

export default InboxRow;
