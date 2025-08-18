"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const [creationStartTime, setCreationStartTime] = useState<number | null>(
    null
  );
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

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
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setTimeout(() => {
            router.refresh();
          }, 2000);
        } else if (status.status === "error") {
          setIsCreating(false);
          setCreationStartTime(null);
          localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      } else {
        console.error(
          `Agent status check failed with status: ${response.status}`
        );
        setMessage("Failed to check agent status. Please try again.");
        setIsCreating(false);
        setCreationStartTime(null);
        localStorage.removeItem(AGENT_CREATION_STORAGE_KEY);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (error) {
      console.error("Failed to check agent status:", error);
    }
  }, [creationStartTime, pollingInterval, router]);

  const startPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(checkAgentStatus, 30000);
    setPollingInterval(interval);

    checkAgentStatus();
  }, [checkAgentStatus, pollingInterval]);

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
      setCreationStartTime(null);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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
      <button
        onClick={createAgent}
        disabled={isCreating}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
      >
        {getStatusIcon()}
        {getButtonText()}
      </button>
      {message && (
        <p
          className={`mt-2 text-sm ${
            message.includes("Error") || message.includes("error")
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
