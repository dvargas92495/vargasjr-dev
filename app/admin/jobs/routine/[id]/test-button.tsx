"use client";

import React, { useState } from "react";
import { testRoutineJobWorkflow } from "@/app/actions";

interface TestButtonProps {
  routineJobId: string;
}

export default function TestButton({ routineJobId }: TestButtonProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; outputs?: unknown; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testRoutineJobWorkflow(routineJobId);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleTest}
        disabled={testing}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Workflow'}
      </button>

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
    </>
  );
}
