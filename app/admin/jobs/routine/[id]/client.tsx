"use client";

import React, { useState } from "react";
import { testRoutineJobWorkflow } from "@/app/actions";

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  sandboxUrl?: string | null;
}

interface RoutineJobDetailClientProps {
  routineJob: RoutineJob;
}

export default function RoutineJobDetailClient({ routineJob }: RoutineJobDetailClientProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; outputs?: unknown; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testRoutineJobWorkflow(routineJob.id);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

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
        
        {routineJob.sandboxUrl && (
          <a
            href={routineJob.sandboxUrl}
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
