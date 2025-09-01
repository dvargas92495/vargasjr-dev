"use client";

import React, { useState } from "react";
import WorkflowOutputDisplay from "@/components/workflow-output-display";
import { Vellum } from "vellum-ai";

interface TestButtonProps {
  workflowDeploymentName: string;
  disabled?: boolean;
}

interface WorkflowStatus {
  status: "idle" | "testing" | "completed" | "error";
  message: string;
  executionId?: string;
  outputs?: unknown;
  error?: string;
}

export default function TestButton({
  workflowDeploymentName,
  disabled = false,
}: TestButtonProps) {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({
    status: "idle",
    message: "",
  });

  const handleTest = async () => {
    setWorkflowStatus({
      status: "testing",
      message: "Starting workflow test...",
    });

    try {
      const eventSource = new EventSource(
        `/api/vellum/workflow-deployments/${workflowDeploymentName}/test-stream`
      );

      eventSource.addEventListener("workflow-initiated", (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: "testing",
          message: data.message,
          executionId: data.executionId,
        });
      });

      eventSource.addEventListener("workflow-event", (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus((prev) => ({
          ...prev,
          message: `Processing ${data.type} event...`,
        }));
      });

      eventSource.addEventListener("workflow-completed", (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: "completed",
          message: data.message,
          executionId: data.executionId,
          outputs: data.outputs,
        });
        eventSource.close();
      });

      eventSource.addEventListener("workflow-error", (event) => {
        const data = JSON.parse(event.data);
        setWorkflowStatus({
          status: "error",
          message: data.message,
          executionId: data.executionId,
          error: data.error,
        });
        eventSource.close();
      });

      eventSource.onerror = () => {
        setWorkflowStatus((prev) => ({
          status: "error",
          message: "Connection error occurred",
          error: "Failed to connect to streaming endpoint",
          executionId: prev.executionId,
        }));
        eventSource.close();
      };
    } catch (err) {
      setWorkflowStatus({
        status: "error",
        message: "Test failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const resetTest = () => {
    setWorkflowStatus({
      status: "idle",
      message: "",
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleTest}
          disabled={disabled || workflowStatus.status === "testing"}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {workflowStatus.status === "testing" ? "Testing..." : "Test Workflow"}
        </button>

        {workflowStatus.status !== "idle" && (
          <button
            onClick={resetTest}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {workflowStatus.executionId && (
        <div className="mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded w-full">
          <h3 className="font-semibold">Execution Link:</h3>
          <a
            href={`https://app.vellum.ai/workflows/executions/${workflowStatus.executionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            View Execution: {workflowStatus.executionId}
          </a>
        </div>
      )}

      {workflowStatus.message && (
        <div
          className={`mt-4 p-4 rounded w-full ${
            workflowStatus.status === "error"
              ? "bg-red-100 border border-red-400 text-red-700"
              : workflowStatus.status === "completed"
              ? "bg-green-100 border border-green-400 text-green-700"
              : "bg-yellow-100 border border-yellow-400 text-yellow-700"
          }`}
        >
          <h3 className="font-semibold">Status:</h3>
          <p>{workflowStatus.message}</p>

          {workflowStatus.outputs !== undefined && (
            <WorkflowOutputDisplay
              outputs={workflowStatus.outputs as Vellum.WorkflowOutput[]}
            />
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
