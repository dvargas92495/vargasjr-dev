"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";

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

function formatTime(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "";
  try {
    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface MessageCardProps {
  message: {
    id: string;
    source: string;
    createdAt: string;
    latestOperationAt?: string | null;
    body: string;
  };
  status: string;
  inboxId: string;
  inboxName?: string | null;
  isSelected?: boolean;
  onSelectionChange?: (messageId: string, selected: boolean) => void;
  showCheckbox?: boolean;
}

const MessageCard = ({
  message,
  status,
  inboxName,
  isSelected = false,
  onSelectionChange,
  showCheckbox = false,
}: MessageCardProps) => {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/admin/messages/inbox/${message.id}`);
  }, [router, message.id]);

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
    },
    []
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelectionChange?.(message.id, e.target.checked);
    },
    [message.id, onSelectionChange]
  );
  const getInitials = (source: string) => {
    return source
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    if (status === "UNREAD") {
      return "bg-amber-100 text-amber-800";
    } else if (status === "ARCHIVED") {
      return "bg-gray-100 text-gray-800";
    } else {
      return "bg-green-100 text-green-800";
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:shadow-md cursor-pointer transition-all duration-200"
    >
      <div className="flex items-start space-x-4">
        {showCheckbox && (
          <div className="flex-shrink-0 flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onClick={handleCheckboxClick}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
          </div>
        )}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
            {getInitials(message.source)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {message.source}
              </p>
              {inboxName && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {inboxName}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                  status
                )}`}
              >
                {status}
              </span>
              <p className="text-xs text-gray-500">
                {formatDate(message.latestOperationAt || message.createdAt)}{" "}
                {formatTime(message.latestOperationAt || message.createdAt)}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {message.body.length > 120
              ? `${message.body.slice(0, 120)}...`
              : message.body}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageCard;
