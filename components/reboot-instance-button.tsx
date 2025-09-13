"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

const REBOOT_STORAGE_KEY = "agent-reboot-state";
const REBOOT_POLL_INTERVAL = 15000;
const REBOOT_TIMEOUT = 300000;

const RebootInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "rebooting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealthStatus = useCallback(async () => {
    if (status !== "rebooting" || !startTime) return;

    try {
      const response = await fetch("/api/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: id }),
      });

      if (response.ok) {
        const healthData = await response.json();

        if (healthData.status === "healthy") {
          setStatus("success");
          setMessage("Agent rebooted successfully!");
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
            setStatus("idle");
            setMessage("");
            router.refresh();
          }, 2000);
        } else {
          const elapsed = Date.now() - startTime;
          if (elapsed < REBOOT_TIMEOUT) {
            setMessage(`Rebooting agent... (${Math.floor(elapsed / 1000)}s)`);
          }
        }
      }
    } catch (err) {
      console.error("Health check failed during reboot:", err);
    }
  }, [id, status, startTime, router]);

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
      setStatus("error");
      setMessage("Reboot timed out");
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
    const rebootStartTime = Date.now();
    setStatus("rebooting");
    setMessage("Initiating agent reboot...");
    setStartTime(rebootStartTime);
    setError(null);

    localStorage.setItem(
      REBOOT_STORAGE_KEY,
      JSON.stringify({
        instanceId: id,
        startTime: rebootStartTime,
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
        setMessage(result.message || "Agent reboot initiated");
        startPolling();
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || "Failed to initiate reboot";
        setStatus("error");
        setMessage(errorMsg);
        setError(errorMsg);
        localStorage.removeItem(REBOOT_STORAGE_KEY);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to reboot agent";
      setStatus("error");
      setMessage(errorMsg);
      setError(errorMsg);
      localStorage.removeItem(REBOOT_STORAGE_KEY);
    }
  };

  const retryReboot = () => {
    setError(null);
    setStatus("idle");
    setMessage("");
    setStartTime(null);
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
        const {
          instanceId,
          startTime: storedStartTime,
          status: storedStatus,
        } = JSON.parse(storedState);
        if (instanceId === id && storedStatus === "rebooting") {
          const elapsed = Date.now() - storedStartTime;
          if (elapsed < REBOOT_TIMEOUT) {
            setStatus("rebooting");
            setMessage(
              `Resuming reboot monitoring... (${Math.floor(elapsed / 1000)}s)`
            );
            setStartTime(storedStartTime);
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
    switch (status) {
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
    if (status === "rebooting") {
      return (
        <div className="inline-block w-4 h-4 mr-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </div>
      );
    }
    return null;
  };

  const isDisabled = status === "rebooting" || status === "success";

  return (
    <div>
      <button
        onClick={status === "error" ? retryReboot : rebootInstance}
        disabled={isDisabled}
        className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        {getStatusIcon()}
        {getButtonText()}
      </button>
      {message && (
        <p
          className={`mt-2 text-sm ${
            status === "error"
              ? "text-red-600"
              : status === "success"
              ? "text-green-600"
              : "text-blue-600"
          }`}
        >
          {message}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default RebootInstanceButton;
