"use client";

import React, { useState, useEffect } from "react";

interface RoutineJobExecution {
  id: string;
  executionId: string;
  outputs: unknown;
  createdAt: string;
}

interface ExecutionHistoryProps {
  routineJobId: string;
}

export default function ExecutionHistory({ routineJobId }: ExecutionHistoryProps) {
  const [executions, setExecutions] = useState<RoutineJobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const response = await fetch(`/api/jobs/routine/${routineJobId}/executions`);
        if (!response.ok) {
          throw new Error('Failed to fetch executions');
        }
        const data = await response.json();
        setExecutions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [routineJobId]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Execution History</h3>
        <p className="text-gray-500">Loading execution history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Execution History</h3>
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Execution History (Last 10)</h3>
      
      {executions.length === 0 ? (
        <p className="text-gray-500">No executions found for this routine job.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4 font-medium text-gray-700">Timestamp</th>
                <th className="text-left py-2 px-4 font-medium text-gray-700">Execution Link</th>
                <th className="text-left py-2 px-4 font-medium text-gray-700">Status</th>
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
                  <td className="py-2 px-4 text-sm text-green-600">
                    Completed
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
