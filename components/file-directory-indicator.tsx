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
  const [currentPath, setCurrentPath] = useState<string>("/home/ubuntu");

  const fetchDirectory = useCallback(async (path?: string) => {
    if (instanceState !== "running") {
      setDirectoryStatus({
        status: "offline",
        error: `Instance ${instanceState || "unknown state"}`,
      });
      return;
    }

    setDirectoryStatus((prev) => ({ ...prev, status: "loading" }));

    try {
      const response = await fetch("/api/file-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, path }),
      });

      if (response.ok) {
        const data = await response.json();
        setDirectoryStatus({
          status: data.status,
          directory: data.directory,
          contents: data.contents,
          error: data.error,
        });
        if (data.directory) {
          setCurrentPath(data.directory);
        }
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
    fetchDirectory(currentPath);
  }, [fetchDirectory, currentPath]);

  const navigateToDirectory = (dirName: string) => {
    const newPath = currentPath === "/" ? `/${dirName}` : `${currentPath}/${dirName}`;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (currentPath === "/") return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
    setCurrentPath(parentPath);
  };

  const canNavigateUp = currentPath !== "/";

  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return "N/A";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
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
        {canNavigateUp && (
          <button
            onClick={navigateUp}
            className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-800"
            title="Go up one directory"
          >
            ↑ Up
          </button>
        )}
        <span className="font-medium text-gray-900">
          Directory: {currentPath}
        </span>
        <button
          onClick={() => fetchDirectory(currentPath)}
          className="text-blue-600 hover:text-blue-800 text-xs"
          title="Refresh file directory"
        >
          ↻
        </button>
      </div>
      <div className="text-xs text-gray-700 mb-2">
        {directories.length} director{directories.length !== 1 ? "ies" : "y"},{" "}
        {files.length} file{files.length !== 1 ? "s" : ""}
      </div>
      {contents.length > 0 && (
        <div className="mt-2 border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 font-medium text-gray-900">Name</th>
                <th className="text-left p-2 font-medium text-gray-900">Type</th>
                <th className="text-right p-2 font-medium text-gray-900">Size</th>
                <th className="text-left p-2 font-medium text-gray-900">Modified</th>
              </tr>
            </thead>
            <tbody>
              {directories.map((item, idx) => (
                <tr key={`dir-${idx}`} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-gray-900">
                    <button
                      onClick={() => navigateToDirectory(item.name)}
                      className="hover:text-blue-600 hover:underline cursor-pointer text-left"
                      title={`Open ${item.name}`}
                    >
                      📁 {item.name}
                    </button>
                  </td>
                  <td className="p-2 text-gray-700">directory</td>
                  <td className="p-2 text-right text-gray-700">-</td>
                  <td className="p-2 text-gray-700">
                    {formatDate(item.modified)}
                  </td>
                </tr>
              ))}
              {files.map((item, idx) => (
                <tr key={`file-${idx}`} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-gray-900">📄 {item.name}</td>
                  <td className="p-2 text-gray-700">file</td>
                  <td className="p-2 text-right text-gray-700">
                    {formatSize(item.size)}
                  </td>
                  <td className="p-2 text-gray-700">
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
