"use client";

import { useCallback, useEffect, useState } from "react";

interface HealthStatus {
  status: "healthy" | "unhealthy" | "loading" | "error" | "offline";
  error?: string;
  diagnostics?: {
    ssm?: {
      registered?: boolean;
      pingStatus?: string;
      lastPingDateTime?: Date;
      timeSinceLastPing?: string;
      platformType?: string;
      agentVersion?: string;
      associationStatus?: string;
      lastAssociationExecutionDate?: Date;
    };
    healthcheck?: {
      environmentVariables?: {
        critical?: Record<string, boolean>;
        optional?: Record<string, boolean>;
      };
      processes?: string;
      memory?: string;
      fatalErrors?: boolean;
    };
    troubleshooting?: string[];
  };
}

interface HealthStatusIndicatorProps {
  instanceId: string;
  publicDns: string;
  keyName: string;
  instanceState: string;
  onHealthStatusChange?: (status: HealthStatus) => void;
}

const HealthStatusIndicator = ({ 
  instanceId, 
  publicDns, 
  keyName, 
  instanceState,
  onHealthStatusChange
}: HealthStatusIndicatorProps) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: "loading" });

  const checkHealth = useCallback(async () => {
    if (instanceState !== "running") {
      const status = { status: "unhealthy" as const, error: `Instance ${instanceState || 'unknown state'}` };
      setHealthStatus(status);
      onHealthStatusChange?.(status);
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
        const status = {
          status: data.status,
          error: data.error,
          diagnostics: data.diagnostics
        };
        setHealthStatus(status);
        onHealthStatusChange?.(status);
      } else {
        const status = { status: "error" as const, error: "Health check failed" };
        setHealthStatus(status);
        onHealthStatusChange?.(status);
      }
    } catch {
      const status = { status: "error" as const, error: "Network error" };
      setHealthStatus(status);
      onHealthStatusChange?.(status);
    }
  }, [instanceId, publicDns, keyName, instanceState, onHealthStatusChange]);

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
      
      {healthStatus.diagnostics?.ssm && (
        <div className="ml-5 mt-2 text-xs">
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-800">Diagnostic Information</summary>
            <div className="mt-2 p-2 bg-gray-50 border rounded text-gray-700">
              <div className="grid grid-cols-2 gap-1 mb-2">
                <div>Status: <span className="font-mono">{healthStatus.diagnostics.ssm.pingStatus || 'Unknown'}</span></div>
                <div>Agent: <span className="font-mono">{healthStatus.diagnostics.ssm.agentVersion || 'Unknown'}</span></div>
                <div>Platform: <span className="font-mono">{healthStatus.diagnostics.ssm.platformType || 'Unknown'}</span></div>
                <div>Last Ping: <span className="font-mono">{healthStatus.diagnostics.ssm.timeSinceLastPing || 'Unknown'}</span></div>
              </div>
              
              {healthStatus.diagnostics.healthcheck && (
                <div className="mb-2 border-t pt-2">
                  <div className="font-medium mb-1">Agent Health:</div>
                  {healthStatus.diagnostics.healthcheck.processes && (
                    <div>Processes: <span className="font-mono">{healthStatus.diagnostics.healthcheck.processes}</span></div>
                  )}
                  {healthStatus.diagnostics.healthcheck.memory && (
                    <div>Memory: <span className="font-mono text-xs">{healthStatus.diagnostics.healthcheck.memory}</span></div>
                  )}
                  {healthStatus.diagnostics.healthcheck.fatalErrors && (
                    <div className="text-red-600 font-medium">⚠️ Fatal errors detected in logs</div>
                  )}
                </div>
              )}
              
              {healthStatus.diagnostics.troubleshooting && healthStatus.diagnostics.troubleshooting.length > 0 && (
                <div className="border-t pt-2">
                  <div className="font-medium mb-1">Troubleshooting Steps:</div>
                  <ol className="list-decimal list-inside space-y-1">
                    {healthStatus.diagnostics.troubleshooting.map((step: string, index: number) => (
                      <li key={index} className="text-sm">{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default HealthStatusIndicator;
