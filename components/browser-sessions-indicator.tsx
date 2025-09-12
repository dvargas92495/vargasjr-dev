"use client";

import { useCallback, useEffect, useState } from "react";

interface BrowserSession {
  id: string;
  createdAt: string;
  lastUsed: string;
  pageCount: number;
}

interface BrowserSessionsStatus {
  status: "loading" | "success" | "error" | "offline";
  sessions?: BrowserSession[];
  error?: string;
}

interface BrowserSessionsIndicatorProps {
  instanceId: string;
  instanceState: string;
}

const BrowserSessionsIndicator = ({
  instanceId,
  instanceState,
}: BrowserSessionsIndicatorProps) => {
  const [sessionsStatus, setSessionsStatus] = useState<BrowserSessionsStatus>({
    status: "loading",
  });

  const fetchSessions = useCallback(async () => {
    if (instanceState !== "running") {
      setSessionsStatus({
        status: "offline",
        error: `Instance ${instanceState || "unknown state"}`,
      });
      return;
    }

    try {
      const response = await fetch("/api/browser-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionsStatus({
          status: data.status,
          sessions: data.sessions,
          error: data.error,
        });
      } else {
        let errorMessage = "Failed to fetch browser sessions";

        try {
          const errorData = await response.json();
          if (errorData.error && errorData.source) {
            errorMessage = `${errorMessage} (${errorData.source}): ${errorData.error}`;
          } else if (errorData.error) {
            errorMessage = `${errorMessage}: ${errorData.error}`;
          } else {
            errorMessage = `${errorMessage} (HTTP ${response.status})`;
          }
        } catch {
          const errorText = await response.text();
          if (
            errorText.includes("<!DOCTYPE html>") ||
            errorText.includes("<html")
          ) {
            errorMessage = `${errorMessage} (Next.js routing error - HTML response received)`;
          } else if (errorText) {
            errorMessage = `${errorMessage} (HTTP ${response.status}): ${errorText}`;
          } else {
            errorMessage = `${errorMessage} (HTTP ${response.status})`;
          }
        }

        setSessionsStatus({
          status: "error",
          error: errorMessage,
        });
      }
    } catch (error) {
      setSessionsStatus({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [instanceId, instanceState]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (sessionsStatus.status === "loading") {
    return (
      <div className="text-sm text-gray-700">
        Browser Sessions: <span className="text-gray-600">Loading...</span>
      </div>
    );
  }

  if (
    sessionsStatus.status === "offline" ||
    sessionsStatus.status === "error"
  ) {
    return (
      <div className="text-sm text-gray-700">
        Browser Sessions:
        <span className="text-red-600 ml-1">
          {sessionsStatus.error || "Unavailable"}
        </span>
      </div>
    );
  }

  const sessions = sessionsStatus.sessions || [];

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Browser Sessions:</span>
        <span className="font-medium">
          {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={fetchSessions}
          className="text-blue-600 hover:text-blue-800 text-xs"
          title="Refresh browser sessions"
        >
          ↻
        </button>
      </div>
      {sessions.length > 0 && (
        <div className="mt-2 ml-4">
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-800 text-xs">
              View session details
            </summary>
            <div className="mt-2 p-2 bg-gray-50 border rounded text-xs">
              {sessions.map((session) => (
                <div key={session.id} className="mb-2 last:mb-0">
                  <div className="font-mono text-gray-800">
                    ID: {session.id}
                  </div>
                  <div className="text-gray-600">
                    Pages: {session.pageCount}
                  </div>
                  <div className="text-gray-600">
                    Created: {formatDate(session.createdAt)}
                  </div>
                  <div className="text-gray-600">
                    Last used: {formatDate(session.lastUsed)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default BrowserSessionsIndicator;
