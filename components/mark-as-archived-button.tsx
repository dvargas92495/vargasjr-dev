"use client";

import React, { useCallback } from "react";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { markMessageAsArchived } from "@/app/actions";
import { useRouter } from "next/navigation";

const MarkAsArchivedButton = ({
  messageId,
  inboxId,
}: {
  messageId: string;
  inboxId: string;
}) => {
  const router = useRouter();

  const onClick = useCallback(async () => {
    try {
      await markMessageAsArchived(messageId, inboxId);
      router.refresh();
    } catch (error) {
      console.error("Failed to mark message as archived:", error);
      alert(
        error instanceof Error ? error.message : "Failed to archive message"
      );
    }
  }, [messageId, inboxId, router]);

  return (
    <button
      onClick={onClick}
      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-700 rounded-full transition-colors"
      title="Mark as archived"
    >
      <ArchiveBoxIcon className="w-5 h-5" />
    </button>
  );
};

export default MarkAsArchivedButton;
