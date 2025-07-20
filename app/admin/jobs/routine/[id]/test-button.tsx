"use client";

import React, { useState } from "react";

interface TestButtonProps {
  routineJobId: string;
}

interface WorkflowStatus {
  status: 'idle' | 'testing' | 'completed' | 'error';
  message: string;
  executionId?: string;
  outputs?: unknown;
  error?: string;
}

export default function TestButton({ routineJobId }: TestButtonProps) {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({
    status: 'idle',
    message: ''
  });

  const handleTest = async () => {
    setWorkflowStatus({
      status: 'testing',
      message: 'Starting workflow test...'
    });

    try {
      const eventSource = new EventSource(`/api/jobs/routine/${routineJobId}/test-stream`);

      eventSource.addEventListener('workflow-initiated', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: 'testing',
          message: data.message,
          executionId: data.executionId
        });
      });

      eventSource.addEventListener('workflow-event', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus(prev => ({
          ...prev,
          message: `Processing ${data.type} event...`
        }));
      });

      eventSource.addEventListener('workflow-completed', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: 'completed',
          message: data.message,
          executionId: data.executionId,
          outputs: data.outputs
        });
        eventSource.close();
      });

      eventSource.addEventListener('workflow-error', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: 'error',
          message: data.message,
          executionId: data.executionId,
          error: data.error
        });
        eventSource.close();
      });

      eventSource.onerror = () => {
        setWorkflowStatus({
          status: 'error',
          message: 'Connection error occurred',
          error: 'Failed to connect to streaming endpoint'
        });
        eventSource.close();
      };

    } catch (err) {
      setWorkflowStatus({
        status: 'error',
        message: 'Test failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const resetTest = () => {
    setWorkflowStatus({
      status: 'idle',
      message: ''
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={workflowStatus.status === 'testing'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {workflowStatus.status === 'testing' ? 'Testing...' : 'Test Workflow'}
        </button>
        
        {workflowStatus.status !== 'idle' && (
          <button
            onClick={resetTest}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {workflowStatus.executionId && (
        <div className="mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          <h3 className="font-semibold">Execution Link:</h3>
          <a
            href={`/workflows/executions/${workflowStatus.executionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            View Execution: {workflowStatus.executionId}
          </a>
        </div>
      )}

      {workflowStatus.message && (
        <div className={`mt-4 p-4 rounded ${
          workflowStatus.status === 'error' 
            ? 'bg-red-100 border border-red-400 text-red-700'
            : workflowStatus.status === 'completed'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          <h3 className="font-semibold">Status:</h3>
          <p>{workflowStatus.message}</p>
          
          {workflowStatus.outputs !== undefined && (
            <pre className="mt-2 text-sm bg-white p-2 rounded overflow-auto">
              {JSON.stringify(workflowStatus.outputs, null, 2)}
            </pre>
          )}
          
          {workflowStatus.error && (
            <p className="mt-2 text-sm font-mono bg-white p-2 rounded">
              Error: {workflowStatus.error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
