"use client";

import { useCallback, useEffect, useState } from "react";

interface LogFile {
  exists: boolean;
  empty?: boolean;
  totalLines?: number;
  lines?: string[];
  error?: string;
}

interface AgentLogsStatus {
  status: "loading" | "success" | "error" | "offline";
  logs?: Record<string, LogFile>;
  error?: string;
}

interface AgentLogsIndicatorProps {
  instanceId: string;
  instanceState: string;
}

const AgentLogsIndicator = ({
  instanceId,
  instanceState,
}: AgentLogsIndicatorProps) => {
  const [logsStatus, setLogsStatus] = useState<AgentLogsStatus>({
    status: "loading",
  });

  const fetchLogs = useCallback(async () => {
    if (instanceState !== "running") {
      setLogsStatus({
        status: "offline",
        error: `Instance ${instanceState || "unknown state"}`,
      });
      return;
    }

    try {
      const response = await fetch("/api/agent-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });

      if (response.ok) {
        const data = await response.json();
        setLogsStatus({
          status: data.status,
          logs: data.logs,
          error: data.error,
        });
      } else {
        let errorMessage = "Failed to fetch agent logs";

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

        setLogsStatus({
          status: "error",
          error: errorMessage,
        });
      }
    } catch (error) {
      setLogsStatus({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [instanceId, instanceState]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (logsStatus.status === "loading") {
    return (
      <div className="text-sm text-gray-700">
        <span className="text-gray-600">Loading...</span>
      </div>
    );
  }

  if (logsStatus.status === "offline" || logsStatus.status === "error") {
    return (
      <div className="text-sm text-gray-700">
        <span className="text-red-600">
          {logsStatus.error || "Unavailable"}
        </span>
      </div>
    );
  }

  const logs = logsStatus.logs || {};
  const availableLogs = Object.keys(logs).filter((file) => logs[file]?.exists);

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {availableLogs.length} log file{availableLogs.length !== 1 ? "s" : ""}{" "}
          available
        </span>
        <button
          onClick={fetchLogs}
          className="text-blue-600 hover:text-blue-800 text-xs"
          title="Refresh agent logs"
        >
          ↻
        </button>
      </div>
      {availableLogs.length > 0 && (
        <div className="mt-2 space-y-2">
          {availableLogs.map((fileName) => {
            const logFile = logs[fileName];
            if (!logFile?.exists) return null;

            return (
              <details key={fileName} className="cursor-pointer">
                <summary className="text-blue-600 hover:text-blue-800 text-xs">
                  {fileName}
                  {logFile.empty && " (empty)"}
                  {logFile.error && " (error reading file)"}
                  {logFile.totalLines &&
                    ` (${logFile.totalLines} lines, showing last ${
                      logFile.lines?.length || 0
                    })`}
                </summary>
                <div className="mt-2 p-2 bg-gray-50 border rounded">
                  {logFile.empty && (
                    <div className="text-xs text-gray-600">
                      Log file is empty
                    </div>
                  )}
                  {logFile.error && (
                    <div className="text-xs text-red-600">
                      Error: {logFile.error}
                    </div>
                  )}
                  {logFile.lines && logFile.lines.length > 0 && (
                    <div className="text-xs font-mono text-gray-800">
                      {logFile.lines.map((line, idx) => (
                        <div key={idx} className="flex">
                          <span className="text-gray-400 select-none text-right w-12 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="whitespace-pre-wrap overflow-x-auto flex-1">
                            {line}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentLogsIndicator;
