"use client";

import React, { useState } from "react";

interface TestButtonProps {
  jobId: string;
}

interface JobStatus {
  status: 'idle' | 'testing' | 'completed' | 'error';
  message: string;
  sessionId?: string;
  error?: string;
}

export default function TestButton({ jobId }: TestButtonProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    status: 'idle',
    message: ''
  });

  const handleTest = async () => {
    setJobStatus({
      status: 'testing',
      message: 'Starting job test...'
    });

    try {
      const eventSource = new EventSource(`/api/jobs/${jobId}/test-stream`);

      eventSource.addEventListener('job-initiated', (event) => {
        const data = JSON.parse(event.data);
        setJobStatus({
          status: 'testing',
          message: data.message,
          sessionId: data.sessionId
        });
      });

      eventSource.addEventListener('job-event', (event) => {
        const data = JSON.parse(event.data);
        setJobStatus(prev => ({
          ...prev,
          message: `Processing ${data.type} event...`
        }));
      });

      eventSource.addEventListener('job-completed', (event) => {
        const data = JSON.parse(event.data);
        setJobStatus({
          status: 'completed',
          message: data.message,
          sessionId: data.sessionId
        });
        eventSource.close();
      });

      eventSource.addEventListener('job-error', (event) => {
        const data = JSON.parse(event.data);
        setJobStatus({
          status: 'error',
          message: data.message,
          sessionId: data.sessionId,
          error: data.error
        });
        eventSource.close();
      });

      eventSource.onerror = () => {
        setJobStatus(prev => ({
          status: 'error',
          message: 'Connection error occurred',
          error: 'Failed to connect to streaming endpoint',
          sessionId: prev.sessionId
        }));
        eventSource.close();
      };

    } catch (err) {
      setJobStatus({
        status: 'error',
        message: 'Test failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const resetTest = () => {
    setJobStatus({
      status: 'idle',
      message: ''
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleTest}
          disabled={jobStatus.status === 'testing'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {jobStatus.status === 'testing' ? 'Testing...' : 'Test Job'}
        </button>
        
        {jobStatus.status !== 'idle' && (
          <button
            onClick={resetTest}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {jobStatus.sessionId && (
        <div className="mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded w-full">
          <h3 className="font-semibold">Job Session Created:</h3>
          <p className="text-sm font-mono break-all">Session ID: {jobStatus.sessionId}</p>
        </div>
      )}

      {jobStatus.message && (
        <div className={`mt-4 p-4 rounded w-full ${
          jobStatus.status === 'error' 
            ? 'bg-red-100 border border-red-400 text-red-700'
            : jobStatus.status === 'completed'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          <h3 className="font-semibold">Status:</h3>
          <p>{jobStatus.message}</p>
          
          {jobStatus.error && (
            <p className="mt-2 text-sm font-mono bg-white p-2 rounded">
              Error: {jobStatus.error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
