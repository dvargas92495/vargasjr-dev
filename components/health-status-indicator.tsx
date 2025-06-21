"use client";

import { useCallback, useEffect, useState } from "react";

interface HealthStatus {
  status: "healthy" | "unhealthy" | "loading" | "error" | "offline";
  error?: string;
}

interface HealthStatusIndicatorProps {
  instanceId: string;
  publicDns: string;
  keyName: string;
  instanceState: string;
}

const HealthStatusIndicator = ({ 
  instanceId, 
  publicDns, 
  keyName, 
  instanceState 
}: HealthStatusIndicatorProps) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: "loading" });

  const checkHealth = useCallback(async () => {
    if (instanceState !== "running") {
      setHealthStatus({ status: "unhealthy", error: "Instance not running" });
      return;
    }

    try {
      const response = await fetch("/api/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, publicDns, keyName }),
      });

      if (response.ok) {
        const data = await response.json();
        setHealthStatus({
          status: data.status,
          error: data.error
        });
      } else {
        setHealthStatus({ status: "error", error: "Health check failed" });
      }
    } catch {
      setHealthStatus({ status: "error", error: "Network error" });
    }
  }, [instanceId, publicDns, keyName, instanceState]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const getStatusColor = () => {
    switch (healthStatus.status) {
      case "healthy": return "bg-green-500";
      case "unhealthy": return "bg-red-500";
      case "offline": return "bg-gray-500";
      case "loading": return "bg-gray-400";
      case "error": return "bg-yellow-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (healthStatus.status) {
      case "healthy": return "Agent Running";
      case "unhealthy": return `Agent Not Running${healthStatus.error ? `: ${healthStatus.error}` : ""}`;
      case "offline": return `Instance Offline${healthStatus.error ? `: ${healthStatus.error}` : ""}`;
      case "loading": return "Checking...";
      case "error": return `Health Check Error${healthStatus.error ? `: ${healthStatus.error}` : ""}`;
      default: return "Unknown";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${getStatusColor()}`}
          title={getStatusText()}
        />
        <span className="text-sm text-gray-600">
          {healthStatus.status === "loading" ? "Checking..." : 
           healthStatus.status === "healthy" ? "Healthy" : 
           healthStatus.status === "offline" ? "Offline" : "Unhealthy"}
        </span>
      </div>
      {healthStatus.status !== "healthy" && healthStatus.status !== "loading" && healthStatus.error && (
        <div className="text-xs text-red-600 ml-5">
          {healthStatus.error}
        </div>
      )}
    </div>
  );
};

export default HealthStatusIndicator;
