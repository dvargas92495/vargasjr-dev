"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";

interface MessageCardProps {
  message: {
    id: string;
    source: string;
    createdAt: Date;
    body: string;
  };
  status: string;
  inboxId: string;
}

const MessageCard = ({ message, status, inboxId }: MessageCardProps) => {
  const router = useRouter();
  
  const handleClick = useCallback(() => {
    router.push(`/admin/inboxes/${inboxId}/messages/${message.id}`);
  }, [router, inboxId, message.id]);

  const getInitials = (source: string) => {
    return source.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    return status === "Unread" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:shadow-md cursor-pointer transition-all duration-200"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
            {getInitials(message.source)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {message.source}
            </p>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                {status}
              </span>
              <p className="text-xs text-gray-500">
                {message.createdAt.toLocaleDateString()} {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {message.body.length > 120 ? `${message.body.slice(0, 120)}...` : message.body}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageCard;
