"use client";

import React, { useCallback, useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);

  const onClick = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await markMessageAsUnread(messageId, inboxId);
      if (!res?.success) {
        alert(res?.error ?? "Failed to mark message as unread");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("Failed to mark message as unread:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to mark message as unread"
      );
    } finally {
      setIsLoading(false);
    }
  }, [messageId, inboxId, router]);

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
      title="Mark as unread"
    >
      <EyeSlashIcon className="w-5 h-5" />
    </button>
  );
};

export default MarkAsUnreadButton;
