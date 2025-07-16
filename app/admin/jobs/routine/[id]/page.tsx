"use client";

import React, { useEffect, useState } from "react";
import { getVellumSandboxUrl } from "@/app/lib/vellum-utils";

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
}

export default function RoutineJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [routineJob, setRoutineJob] = useState<RoutineJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; outputs?: unknown; message: string } | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;

    const fetchRoutineJob = async () => {
      try {
        const response = await fetch(`/api/jobs/routine/${resolvedParams.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch routine job');
        }
        const data = await response.json();
        setRoutineJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRoutineJob();
  }, [resolvedParams]);

  const handleTest = async () => {
    if (!routineJob) return;

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/routine/${routineJob.id}/test`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Test failed');
      }
      
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading routine job...</div>;
  }

  if (error && !routineJob) {
    return <div className="p-6 text-red-600">Error: {error}</div>;
  }

  if (!routineJob) {
    return <div className="p-6">Routine job not found</div>;
  }

  const sandboxUrl = getVellumSandboxUrl(routineJob.name);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-xl font-bold">Routine Job Details</h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <p className="mt-1 text-sm text-gray-900">{routineJob.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cron Expression</label>
            <p className="mt-1 text-sm text-gray-900">{routineJob.cronExpression}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <p className="mt-1 text-sm text-gray-900">
              {routineJob.enabled ? (
                <span className="text-green-600 font-semibold">✓ Enabled</span>
              ) : (
                <span className="text-red-600 font-semibold">✗ Disabled</span>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Created At</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(routineJob.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Workflow'}
        </button>
        
        {sandboxUrl && (
          <a
            href={sandboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Open in Vellum Sandbox
          </a>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {testResult && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-semibold">Test Result:</h3>
          <p>{testResult.message}</p>
          {testResult.outputs !== undefined && (
            <pre className="mt-2 text-sm bg-white p-2 rounded">
              {JSON.stringify(testResult.outputs, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
