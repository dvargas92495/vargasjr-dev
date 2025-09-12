"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

interface RebootStatus {
  status: "idle" | "rebooting" | "success" | "error";
  message: string;
  startTime?: number;
}

const REBOOT_STORAGE_KEY = "agent-reboot-state";
const REBOOT_POLL_INTERVAL = 15000;
const REBOOT_TIMEOUT = 300000;

const RebootInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const [rebootStatus, setRebootStatus] = useState<RebootStatus>({
    status: "idle",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealthStatus = useCallback(async () => {
    if (rebootStatus.status !== "rebooting" || !rebootStatus.startTime) return;

    try {
      const response = await fetch("/api/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: id }),
      });

      if (response.ok) {
        const healthData = await response.json();
        
        if (healthData.status === "healthy") {
          setRebootStatus({ status: "success", message: "Agent rebooted successfully!" });
          setError(null);
          localStorage.removeItem(REBOOT_STORAGE_KEY);
          
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          setTimeout(() => {
            setRebootStatus({ status: "idle", message: "" });
            router.refresh();
          }, 2000);
        } else {
          const elapsed = Date.now() - rebootStatus.startTime;
          if (elapsed < REBOOT_TIMEOUT) {
            setRebootStatus({
              status: "rebooting",
              message: `Rebooting agent... (${Math.floor(elapsed / 1000)}s)`,
              startTime: rebootStatus.startTime,
            });
          }
        }
      }
    } catch (err) {
      console.error("Health check failed during reboot:", err);
    }
  }, [id, rebootStatus, router]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const interval = setInterval(checkHealthStatus, REBOOT_POLL_INTERVAL);
    pollingIntervalRef.current = interval;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const timeout = setTimeout(() => {
      setRebootStatus({ status: "error", message: "Reboot timed out" });
      setError("Reboot operation timed out after 5 minutes");
      localStorage.removeItem(REBOOT_STORAGE_KEY);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, REBOOT_TIMEOUT);
    timeoutRef.current = timeout;

    checkHealthStatus();
  }, [checkHealthStatus]);

  const rebootInstance = async () => {
    const startTime = Date.now();
    setRebootStatus({
      status: "rebooting",
      message: "Initiating agent reboot...",
      startTime,
    });
    setError(null);

    localStorage.setItem(
      REBOOT_STORAGE_KEY,
      JSON.stringify({
        instanceId: id,
        startTime,
        status: "rebooting",
      })
    );

    try {
      const response = await fetch("/api/reboot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: id }),
      });

      if (response.ok) {
        const result = await response.json();
        setRebootStatus({
          status: "rebooting",
          message: result.message || "Agent reboot initiated",
          startTime,
        });
        startPolling();
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || "Failed to initiate reboot";
        setRebootStatus({ status: "error", message: errorMsg });
        setError(errorMsg);
        localStorage.removeItem(REBOOT_STORAGE_KEY);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to reboot agent";
      setRebootStatus({ status: "error", message: errorMsg });
      setError(errorMsg);
      localStorage.removeItem(REBOOT_STORAGE_KEY);
    }
  };

  const retryReboot = () => {
    setError(null);
    setRebootStatus({ status: "idle", message: "" });
    localStorage.removeItem(REBOOT_STORAGE_KEY);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const storedState = localStorage.getItem(REBOOT_STORAGE_KEY);
    if (storedState) {
      try {
        const { instanceId, startTime, status } = JSON.parse(storedState);
        if (instanceId === id && status === "rebooting") {
          const elapsed = Date.now() - startTime;
          if (elapsed < REBOOT_TIMEOUT) {
            setRebootStatus({
              status: "rebooting",
              message: `Resuming reboot monitoring... (${Math.floor(elapsed / 1000)}s)`,
              startTime,
            });
            startPolling();
          } else {
            localStorage.removeItem(REBOOT_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error("Failed to restore reboot state:", err);
        localStorage.removeItem(REBOOT_STORAGE_KEY);
      }
    }
  }, [id, startPolling]);

  const getButtonText = () => {
    switch (rebootStatus.status) {
      case "rebooting":
        return "Rebooting...";
      case "success":
        return "Rebooted Successfully";
      case "error":
        return "Retry Reboot";
      default:
        return "Reboot Agent";
    }
  };

  const getStatusIcon = () => {
    if (rebootStatus.status === "rebooting") {
      return (
        <div className="inline-block w-4 h-4 mr-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </div>
      );
    }
    return null;
  };

  const isDisabled = rebootStatus.status === "rebooting" || rebootStatus.status === "success";

  return (
    <div>
      <button
        onClick={rebootStatus.status === "error" ? retryReboot : rebootInstance}
        disabled={isDisabled}
        className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        {getStatusIcon()}
        {getButtonText()}
      </button>
      {rebootStatus.message && (
        <p
          className={`mt-2 text-sm ${
            rebootStatus.status === "error"
              ? "text-red-600"
              : rebootStatus.status === "success"
              ? "text-green-600"
              : "text-blue-600"
          }`}
        >
          {rebootStatus.message}
        </p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default RebootInstanceButton;
