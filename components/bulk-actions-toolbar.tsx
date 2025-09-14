"use client";

import React, { useCallback } from "react";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { bulkArchiveMessages } from "@/app/actions";
import { useRouter } from "next/navigation";

interface BulkActionsToolbarProps {
  selectedMessageIds: Set<string>;
  inboxId: string;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalMessages: number;
}

const BulkActionsToolbar = ({
  selectedMessageIds,
  inboxId,
  onClearSelection,
  onSelectAll,
  onDeselectAll,
  totalMessages,
}: BulkActionsToolbarProps) => {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = React.useState(false);

  const handleBulkArchive = useCallback(async () => {
    if (selectedMessageIds.size === 0) return;

    setIsArchiving(true);
    try {
      await bulkArchiveMessages(Array.from(selectedMessageIds), inboxId);
      onClearSelection();
      router.refresh();
    } catch (error) {
      console.error("Failed to archive messages:", error);
      alert(
        error instanceof Error ? error.message : "Failed to archive messages"
      );
    } finally {
      setIsArchiving(false);
    }
  }, [selectedMessageIds, inboxId, onClearSelection, router]);

  const allSelected =
    selectedMessageIds.size === totalMessages && totalMessages > 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedMessageIds.size} message
            {selectedMessageIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex space-x-2">
            {!allSelected ? (
              <button
                onClick={onSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Select all
              </button>
            ) : (
              <button
                onClick={onDeselectAll}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Deselect all
              </button>
            )}
            <button
              onClick={onClearSelection}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear selection
            </button>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleBulkArchive}
            disabled={selectedMessageIds.size === 0 || isArchiving}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArchiveBoxIcon className="w-4 h-4 mr-2" />
            {isArchiving ? "Archiving..." : "Archive Selected"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsToolbar;
