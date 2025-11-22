"use client";

import { useCallback, useEffect, useState } from "react";

interface FileDirectoryItem {
  name: string;
  type: "file" | "directory" | "unknown";
  size?: number;
  modified?: string;
  error?: string;
}

interface FileDirectoryStatus {
  status: "loading" | "success" | "error" | "offline";
  directory?: string;
  contents?: FileDirectoryItem[];
  error?: string;
}

interface FileDirectoryIndicatorProps {
  instanceId: string;
  instanceState: string;
}

const FileDirectoryIndicator = ({
  instanceId,
  instanceState,
}: FileDirectoryIndicatorProps) => {
  const [directoryStatus, setDirectoryStatus] = useState<FileDirectoryStatus>({
    status: "loading",
  });

  const fetchDirectory = useCallback(async () => {
    if (instanceState !== "running") {
      setDirectoryStatus({
        status: "offline",
        error: `Instance ${instanceState || "unknown state"}`,
      });
      return;
    }

    try {
      const response = await fetch("/api/file-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });

      if (response.ok) {
        const data = await response.json();
        setDirectoryStatus({
          status: data.status,
          directory: data.directory,
          contents: data.contents,
          error: data.error,
        });
      } else {
        let errorMessage = "Failed to fetch file directory";

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

        setDirectoryStatus({
          status: "error",
          error: errorMessage,
        });
      }
    } catch (error) {
      setDirectoryStatus({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [instanceId, instanceState]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return "N/A";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (directoryStatus.status === "loading") {
    return (
      <div className="text-sm text-gray-700">
        <span className="text-gray-600">Loading...</span>
      </div>
    );
  }

  if (
    directoryStatus.status === "offline" ||
    directoryStatus.status === "error"
  ) {
    return (
      <div className="text-sm text-gray-700">
        <span className="text-red-600">
          {directoryStatus.error || "Unavailable"}
        </span>
      </div>
    );
  }

  const contents = directoryStatus.contents || [];
  const directories = contents.filter((item) => item.type === "directory");
  const files = contents.filter((item) => item.type === "file");

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium">
          Directory: {directoryStatus.directory || "/home/ubuntu"}
        </span>
        <button
          onClick={fetchDirectory}
          className="text-blue-600 hover:text-blue-800 text-xs"
          title="Refresh file directory"
        >
          ↻
        </button>
      </div>
      <div className="text-xs text-gray-600 mb-2">
        {directories.length} director{directories.length !== 1 ? "ies" : "y"},{" "}
        {files.length} file{files.length !== 1 ? "s" : ""}
      </div>
      {contents.length > 0 && (
        <div className="mt-2 border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 font-medium">Name</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-right p-2 font-medium">Size</th>
                <th className="text-left p-2 font-medium">Modified</th>
              </tr>
            </thead>
            <tbody>
              {directories.map((item, idx) => (
                <tr
                  key={`dir-${idx}`}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="p-2 font-mono">
                    📁 {item.name}
                  </td>
                  <td className="p-2 text-gray-600">directory</td>
                  <td className="p-2 text-right text-gray-600">-</td>
                  <td className="p-2 text-gray-600">
                    {formatDate(item.modified)}
                  </td>
                </tr>
              ))}
              {files.map((item, idx) => (
                <tr
                  key={`file-${idx}`}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="p-2 font-mono">
                    📄 {item.name}
                  </td>
                  <td className="p-2 text-gray-600">file</td>
                  <td className="p-2 text-right text-gray-600">
                    {formatSize(item.size)}
                  </td>
                  <td className="p-2 text-gray-600">
                    {formatDate(item.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FileDirectoryIndicator;
