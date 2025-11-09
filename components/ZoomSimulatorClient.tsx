"use client";

import React, { useState } from "react";
import { VideoCameraIcon } from "@heroicons/react/24/outline";

export default function ZoomSimulatorClient() {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!meetingUrl.trim()) {
      setError("Please enter a Zoom meeting URL");
      return;
    }

    setIsJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/recall/bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meeting_url: meetingUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create bot");
      }

      setSuccess(`Bot created successfully! Bot ID: ${data.id}`);
      setMeetingUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isJoining) {
      handleJoin();
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <VideoCameraIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Join Zoom Meeting
            </h2>
            <p className="text-sm text-gray-500">
              Enter a Zoom meeting URL to create a bot
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="meeting-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Meeting URL
            </label>
            <input
              id="meeting-url"
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://zoom.us/j/123456789?pwd=..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              disabled={isJoining}
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={isJoining || !meetingUrl.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <VideoCameraIcon className="w-5 h-5" />
            {isJoining ? "Joining..." : "Join Meeting"}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            How it works
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Enter a valid Zoom meeting URL</li>
            <li>• Click &quot;Join Meeting&quot; to create a Recall bot</li>
            <li>• The bot will join the meeting and start recording</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
