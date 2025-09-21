"use client";

import React, { useState, useCallback } from "react";
import MessageCard from "./message-card";
import BulkActionsToolbar from "./bulk-actions-toolbar";
import PaginationControls from "./pagination-controls";

interface RecentMessage {
  id: string;
  displayName: string | null;
  fullName: string | null;
  email: string | null;
  createdAt: Date;
  body: string;
  inboxId: string;
  inboxName: string | null;
  inboxDisplayName: string | null;
}

interface RecentMessagesSectionProps {
  recentMessages: RecentMessage[];
  statuses: Record<string, string>;
  currentPage: number;
  totalPages: number;
}

const RecentMessagesSection = ({
  recentMessages,
  statuses,
  currentPage,
  totalPages,
}: RecentMessagesSectionProps) => {
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set()
  );

  const handleSelectionChange = useCallback(
    (messageId: string, selected: boolean) => {
      setSelectedMessageIds((prev) => {
        const newSet = new Set(prev);
        if (selected) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    setSelectedMessageIds(new Set(recentMessages.map((msg) => msg.id)));
  }, [recentMessages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recent Messages</h2>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl="/admin/inboxes"
        />
      </div>

      {selectedMessageIds.size > 0 && (
        <BulkActionsToolbar
          selectedMessageIds={selectedMessageIds}
          inboxId=""
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          totalMessages={recentMessages.length}
        />
      )}

      {recentMessages.length > 0 ? (
        <div className="space-y-3">
          {recentMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={{
                ...message,
                source:
                  message.displayName ||
                  message.fullName ||
                  message.email ||
                  "Unknown",
              }}
              status={statuses[message.id] || "Unread"}
              inboxId={message.inboxId}
              inboxName={message.inboxName}
              showCheckbox={true}
              isSelected={selectedMessageIds.has(message.id)}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-left py-4">
          No recent messages found.
        </div>
      )}
    </div>
  );
};

export default RecentMessagesSection;
