"use client";

import React, { useCallback } from "react";
import { EyeSlashIcon } from "@heroicons/react/24/outline";
import { markMessageAsUnread } from "@/app/actions";
import { useRouter } from "next/navigation";

const MarkAsUnreadButton = ({
  messageId,
  inboxId,
}: {
  messageId: string;
  inboxId: string;
}) => {
  const router = useRouter();

  const onClick = useCallback(async () => {
    try {
      await markMessageAsUnread(messageId, inboxId);
      router.refresh();
    } catch (error) {
      console.error("Failed to mark message as unread:", error);
    }
  }, [messageId, inboxId, router]);

  return (
    <button
      onClick={onClick}
      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-700 rounded-full transition-colors"
      title="Mark as unread"
    >
      <EyeSlashIcon className="w-5 h-5" />
    </button>
  );
};

export default MarkAsUnreadButton;
