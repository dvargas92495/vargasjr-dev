"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PaginationControls from "@/components/pagination-controls";

interface RoutineJobExecution {
  id: string;
  executionId: string;
  outputs: unknown;
  error?: unknown;
  createdAt: string;
  environment?: string;
  location?: string;
}

interface ExecutionHistoryProps {
  routineJobId: string;
}

interface ExecutionHistoryResponse {
  executions: RoutineJobExecution[];
  totalCount: number;
}

export default function ExecutionHistory({
  routineJobId,
}: ExecutionHistoryProps) {
  const [executions, setExecutions] = useState<RoutineJobExecution[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const selectedEnv = searchParams.get("env") || "";
  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const url = new URL(
          `/api/jobs/routine/${routineJobId}/executions`,
          window.location.origin
        );
        if (currentPage > 1) {
          url.searchParams.set("page", currentPage.toString());
        }
        if (selectedEnv) {
          url.searchParams.set("env", selectedEnv);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error("Failed to fetch executions");
        }
        const data: ExecutionHistoryResponse = await response.json();
        setExecutions(data.executions);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [routineJobId, currentPage, selectedEnv]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          Execution History
        </h3>
        <p className="text-gray-700">Loading execution history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          Execution History
        </h3>
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Execution History
        </h3>
        {totalPages > 1 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={`/admin/jobs/routine/${routineJobId}`}
          />
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="env-filter"
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          Filter by Environment:
        </label>
        <input
          type="text"
          id="env-filter"
          value={selectedEnv}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) {
              params.set("env", e.target.value);
            } else {
              params.delete("env");
            }
            params.delete("page");
            window.location.href = `/admin/jobs/routine/${routineJobId}?${params.toString()}`;
          }}
          placeholder="e.g., preview-535, production"
          className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {executions.length === 0 ? (
        <p className="text-gray-700">
          No executions found for this routine job.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4 font-medium text-gray-700">
                  Timestamp
                </th>
                <th className="text-left py-2 px-4 font-medium text-gray-700">
                  Execution Link
                </th>
                <th className="text-left py-2 px-4 font-medium text-gray-700">
                  Metadata
                </th>
                <th className="text-left py-2 px-4 font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm text-gray-900">
                    {new Date(execution.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4">
                    <a
                      href={`https://app.vellum.ai/workflows/executions/${execution.executionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      {execution.executionId}
                    </a>
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-700">
                    <div>
                      <div>Env: {execution.environment || "unknown"}</div>
                      <div>Location: {execution.location || "unknown"}</div>
                    </div>
                  </td>
                  <td
                    className={`py-2 px-4 text-sm ${
                      execution.error ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {execution.error ? "Failure" : "Success"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
