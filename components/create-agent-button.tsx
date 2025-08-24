"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface AgentCreationStatus {
  status: "creating" | "booting" | "ready" | "error";
  message: string;
  instanceId?: string;
}

interface CreateAgentButtonProps {
  initialWorkflowState?: {
    hasRunningWorkflow: boolean;
    workflowRunId?: number;
    createdAt?: string;
  };
}

const AGENT_CREATION_STORAGE_KEY = "agent-creation-state";

const CreateAgentButton = ({
  initialWorkflowState,
}: CreateAgentButtonProps = {}) => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [creationStartTime, setCreationStartTime] = useState<number | null>(
    null
  );
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkAgentStatus = useCallback(async () => {
    if (!creationStartTime) return;

    try {
      const response = await fetch("/api/agent-creation-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ creationStartTime }),
      });

      if (response.ok) {
        const status: AgentCreationStatus = await response.json();
        setMessage(status.message);

        if (status.status === "ready") {
          setIsCreating(false);
          setCreationStartTime(null);
          localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setTimeout(() => {
            router.refresh();
          }, 2000);
        } else if (status.status === "error") {
          setIsCreating(false);
          setHasError(true);
          setCreationStartTime(null);
          localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } else {
        console.error(
          `Agent status check failed with status: ${response.status}`
        );
        setMessage("Failed to check agent status. Please try again.");
        setIsCreating(false);
        setHasError(true);
        setCreationStartTime(null);
        localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Failed to check agent status:", error);
    }
  }, [creationStartTime, router]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const interval = setInterval(checkAgentStatus, 30000);
    pollingIntervalRef.current = interval;

    checkAgentStatus();
  }, [checkAgentStatus]);

  const createAgent = async () => {
    setIsCreating(true);
    setMessage("");
    const startTime = Date.now();
    setCreationStartTime(startTime);

    localStorage.setItem(
      AGENT_CREATION_STORAGE_KEY,
      JSON.stringify({
        isCreating: true,
        creationStartTime: startTime,
        message: "",
      })
    );

    try {
      const response = await fetch("/api/create-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        startPolling();
      } else {
        setMessage(`Error: ${result.error}`);
        setIsCreating(false);
        setCreationStartTime(null);
      }
    } catch {
      setMessage("Failed to start agent creation");
      setIsCreating(false);
      setHasError(true);
      setCreationStartTime(null);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const storedState = localStorage.getItem(AGENT_CREATION_STORAGE_KEY);
    if (storedState) {
      try {
        const {
          isCreating: storedIsCreating,
          creationStartTime: storedStartTime,
          message: storedMessage,
        } = JSON.parse(storedState);
        if (storedIsCreating && storedStartTime) {
          setIsCreating(true);
          setCreationStartTime(storedStartTime);
          setMessage(storedMessage || "Resuming agent creation...");
          startPolling();
        }
      } catch (error) {
        console.error("Failed to restore creation state:", error);
        localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
      }
    }
  }, [startPolling]);

  useEffect(() => {
    if (initialWorkflowState?.hasRunningWorkflow && !isCreating) {
      const workflowStartTime = initialWorkflowState.createdAt
        ? new Date(initialWorkflowState.createdAt).getTime()
        : Date.now();

      setIsCreating(true);
      setCreationStartTime(workflowStartTime);
      setMessage("Agent creation workflow is running...");

      localStorage.setItem(
        AGENT_CREATION_STORAGE_KEY,
        JSON.stringify({
          isCreating: true,
          creationStartTime: workflowStartTime,
          message: "Agent creation workflow is running...",
        })
      );

      startPolling();
    }
  }, [initialWorkflowState, isCreating, startPolling]);

  const retryCreation = () => {
    setHasError(false);
    setMessage("");
    setIsCreating(false);
    setCreationStartTime(null);
    localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const getButtonText = () => {
    if (!isCreating) return "Create Agent";
    if (message.includes("dispatched")) return "Creating Agent...";
    if (message.includes("being created")) return "Creating Instance...";
    if (message.includes("starting up")) return "Booting Agent...";
    if (message.includes("starting services")) return "Starting Services...";
    return "Creating Agent...";
  };

  const getStatusIcon = () => {
    if (!isCreating) return null;
    return (
      <div className="inline-block w-4 h-4 mr-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={hasError ? retryCreation : createAgent}
          disabled={isCreating}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
        >
          {getStatusIcon()}
          {hasError ? "Try Again" : getButtonText()}
        </button>
        {hasError && (
          <button
            onClick={retryCreation}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${
            message.includes("Error") || message.includes("error") || hasError
              ? "text-red-600"
              : message.includes("ready")
              ? "text-green-600"
              : "text-blue-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default CreateAgentButton;
