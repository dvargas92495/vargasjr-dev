"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface WorkflowDeployment {
  id: string;
  name: string;
  label: string;
}

interface ApiErrorResponse {
  error: string;
  details?: string;
}

export default function NewRoutineJobPage() {
  const router = useRouter();
  const [workflowDeployments, setWorkflowDeployments] = useState<WorkflowDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflowDeployments = async () => {
      try {
        const response = await fetch('/api/vellum/workflow-deployments');
        if (!response.ok) {
          throw new Error('Failed to fetch workflow deployments');
        }
        const data = await response.json();
        setWorkflowDeployments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowDeployments();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const scheduleDescription = formData.get("scheduleDescription");

      const workflowName = name || "test-workflow";
      if (scheduleDescription) {
        try {
          const response = await fetch('/api/jobs/routine', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: workflowName, scheduleDescription }),
          });

          if (!response.ok) {
            const errorData: ApiErrorResponse = await response.json();
            const errorMessage = errorData.details || errorData.error || 'Failed to create routine job';
            throw new Error(errorMessage);
          }

          router.push("/admin/jobs");
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create routine job');
        }
      }
    },
    [router]
  );

  if (loading) {
    return <div className="max-w-md w-full">Loading workflow deployments...</div>;
  }

  return (
    <div className="max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">New Routine Job</h2>
      {error && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="block mb-1">
            Workflow Deployment
          </label>
          <select
            id="name"
            name="name"
            className="w-full p-2 border rounded text-black"
          >
            <option value="">Select a workflow deployment</option>
            {workflowDeployments.map((deployment) => (
              <option key={deployment.id} value={deployment.name}>
                {deployment.label || deployment.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scheduleDescription" className="block mb-1">
            Schedule Description
          </label>
          <input
            type="text"
            id="scheduleDescription"
            name="scheduleDescription"
            required
            placeholder="e.g., every Monday at 5pm, daily at 9am, every weekday at 8:30am"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
        >
          Create Routine Job
        </button>
      </form>
    </div>
  );
}
