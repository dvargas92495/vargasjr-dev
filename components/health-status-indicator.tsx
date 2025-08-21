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
    networkError?: {
      message: string;
      type: string;
      statusCode?: number;
      statusText?: string;
      timing?: number;
      connectivity: {
        healthCheckApi: boolean;
        basicConnectivity: boolean;
      };
      attemptedUrl?: string;
      errorName?: string;
      errorCode?: string | number;
      timedOut?: boolean;
    };
    memoryDiagnostics?: {
      hasMemoryIssues: boolean;
      memoryErrors: string[];
      consoleOutputError?: string;
    };
  };
}

interface HealthStatusIndicatorProps {
  instanceId: string;
  publicDns: string;
  keyName: string;
  instanceState: string;
  onHealthStatusChange?: (status: HealthStatus) => void;
}

const captureNetworkErrorDetails = async (error: unknown) => {
  const startTime = Date.now();

  const errorInfo = {
    message: "Network error occurred",
    type: "unknown",
    statusCode: undefined as number | undefined,
    statusText: undefined as string | undefined,
    timing: undefined as number | undefined,
    connectivity: {
      healthCheckApi: false,
      basicConnectivity: false,
    },
  };

  if (error instanceof TypeError && error.message.includes("fetch")) {
    errorInfo.type = "fetch_failed";
    errorInfo.message = "Failed to connect to health check API";
  } else if (error instanceof Error) {
    errorInfo.message = error.message;
    errorInfo.type = "request_error";
  }

  try {
    const connectivityTest = await fetch("/api/health-check", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    errorInfo.connectivity.basicConnectivity = true;
    errorInfo.connectivity.healthCheckApi = connectivityTest.ok;
    errorInfo.statusCode = connectivityTest.status;
    errorInfo.statusText = connectivityTest.statusText;
  } catch {
    errorInfo.connectivity.basicConnectivity = false;
    errorInfo.connectivity.healthCheckApi = false;
  }

  errorInfo.timing = Date.now() - startTime;

  return errorInfo;
};

const HealthStatusIndicator = ({
  instanceId,
  publicDns,
  keyName,
  instanceState,
  onHealthStatusChange,
}: HealthStatusIndicatorProps) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    status: "loading",
  });

  const checkHealth = useCallback(async () => {
    if (instanceState !== "running") {
      const status = {
        status: "unhealthy" as const,
        error: `Instance ${instanceState || "unknown state"}`,
      };
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
          diagnostics: data.diagnostics,
        };
        setHealthStatus(status);
        onHealthStatusChange?.(status);
      } else {
        const errorText = await response.text();
        const errorDetails = await captureNetworkErrorDetails(
          new Error(`HTTP ${response.status}: ${response.statusText}`)
        );
        errorDetails.statusCode = response.status;
        errorDetails.statusText = response.statusText;
        errorDetails.message = `Health check failed: ${
          errorText || response.statusText
        }`;
        errorDetails.type = "http_error";

        const status = {
          status: "error" as const,
          error: errorDetails.message,
          diagnostics: {
            networkError: errorDetails,
          },
        };
        setHealthStatus(status);
        onHealthStatusChange?.(status);
      }
    } catch (error) {
      const errorDetails = await captureNetworkErrorDetails(error);
      const status = {
        status: "error" as const,
        error: errorDetails.message,
        diagnostics: {
          networkError: errorDetails,
        },
      };
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
      case "healthy":
        return "bg-green-500";
      case "unhealthy":
        return "bg-red-500";
      case "offline":
        return "bg-gray-500";
      case "loading":
        return "bg-gray-400";
      case "error":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (healthStatus.status) {
      case "healthy":
        return "Agent Running";
      case "unhealthy":
        return `Agent Not Running${
          healthStatus.error ? `: ${healthStatus.error}` : ""
        }`;
      case "offline":
        return `Instance Offline${
          healthStatus.error ? `: ${healthStatus.error}` : ""
        }`;
      case "loading":
        return "Checking...";
      case "error":
        return `Health Check Error${
          healthStatus.error ? `: ${healthStatus.error}` : ""
        }`;
      default:
        return "Unknown";
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
          {healthStatus.status === "loading"
            ? "Checking..."
            : healthStatus.status === "healthy"
            ? "Healthy"
            : healthStatus.status === "offline"
            ? "Offline"
            : "Unhealthy"}
        </span>
      </div>
      {healthStatus.status !== "healthy" &&
        healthStatus.status !== "loading" &&
        healthStatus.error && (
          <div className="text-xs text-red-600 ml-5">{healthStatus.error}</div>
        )}

      {(healthStatus.diagnostics?.ssm ||
        healthStatus.diagnostics?.networkError ||
        healthStatus.diagnostics?.memoryDiagnostics ||
        (healthStatus.status === "offline" && healthStatus.diagnostics)) && (
        <div className="ml-5 mt-2 text-xs">
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-800">
              {healthStatus.diagnostics?.networkError
                ? "Network Error Details"
                : "Diagnostic Information"}
            </summary>
            <div className="mt-2 p-2 bg-gray-50 border rounded text-gray-700">
              {healthStatus.diagnostics?.ssm && (
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <div>
                    Status:{" "}
                    <span className="font-mono">
                      {healthStatus.diagnostics.ssm.pingStatus || "Unknown"}
                    </span>
                  </div>
                  <div>
                    Agent:{" "}
                    <span className="font-mono">
                      {healthStatus.diagnostics.ssm.agentVersion || "Unknown"}
                    </span>
                  </div>
                  <div>
                    Platform:{" "}
                    <span className="font-mono">
                      {healthStatus.diagnostics.ssm.platformType || "Unknown"}
                    </span>
                  </div>
                  <div>
                    Last Ping:{" "}
                    <span className="font-mono">
                      {healthStatus.diagnostics.ssm.timeSinceLastPing ||
                        "Unknown"}
                    </span>
                  </div>
                </div>
              )}

              {healthStatus.diagnostics.healthcheck && (
                <div className="mb-2 border-t pt-2">
                  <div className="font-medium mb-1">Agent Health:</div>
                  {healthStatus.diagnostics.healthcheck.processes && (
                    <div>
                      Processes:{" "}
                      <span className="font-mono">
                        {healthStatus.diagnostics.healthcheck.processes}
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.healthcheck.memory && (
                    <div>
                      Memory:{" "}
                      <span className="font-mono text-xs">
                        {healthStatus.diagnostics.healthcheck.memory}
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.healthcheck.fatalErrors && (
                    <div className="text-red-600 font-medium">
                      ⚠️ Fatal errors detected in logs
                    </div>
                  )}
                </div>
              )}

              {healthStatus.diagnostics?.networkError && (
                <div className="mb-2 border-t pt-2">
                  <div className="font-medium mb-1">Network Error Details:</div>
                  <div>
                    Type:{" "}
                    <span className="font-mono">
                      {healthStatus.diagnostics.networkError.type}
                    </span>
                  </div>
                  {healthStatus.diagnostics.networkError.statusCode !==
                    undefined && (
                    <div>
                      Status:{" "}
                      <span className="font-mono">
                        {healthStatus.diagnostics.networkError.statusCode}{" "}
                        {healthStatus.diagnostics.networkError.statusText}
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.networkError.timing !==
                    undefined && (
                    <div>
                      Response Time:{" "}
                      <span className="font-mono">
                        {healthStatus.diagnostics.networkError.timing}ms
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.networkError.timedOut && (
                    <div className="text-yellow-700">
                      Timed Out: <span className="font-mono">Yes</span>
                    </div>
                  )}
                  {healthStatus.diagnostics.networkError.errorName && (
                    <div>
                      Error Name:{" "}
                      <span className="font-mono">
                        {healthStatus.diagnostics.networkError.errorName}
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.networkError.errorCode !==
                    undefined && (
                    <div>
                      Error Code:{" "}
                      <span className="font-mono">
                        {String(
                          healthStatus.diagnostics.networkError.errorCode
                        )}
                      </span>
                    </div>
                  )}
                  {healthStatus.diagnostics.networkError.attemptedUrl && (
                    <div>
                      Attempted URL:{" "}
                      <span className="font-mono break-all">
                        {healthStatus.diagnostics.networkError.attemptedUrl}
                      </span>
                    </div>
                  )}
                  <div className="mt-1">
                    <div>
                      Health Check API:{" "}
                      <span
                        className={`font-mono ${
                          healthStatus.diagnostics.networkError.connectivity
                            .healthCheckApi
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {healthStatus.diagnostics.networkError.connectivity
                          .healthCheckApi
                          ? "✓ Reachable"
                          : "✗ Unreachable"}
                      </span>
                    </div>
                    <div>
                      Basic Connectivity:{" "}
                      <span
                        className={`font-mono ${
                          healthStatus.diagnostics.networkError.connectivity
                            .basicConnectivity
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {healthStatus.diagnostics.networkError.connectivity
                          .basicConnectivity
                          ? "✓ Working"
                          : "✗ Failed"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {healthStatus.diagnostics?.memoryDiagnostics && (
                <div className="mb-2 border-t pt-2">
                  <div className="font-medium mb-1">Memory Diagnostics:</div>
                  {healthStatus.diagnostics.memoryDiagnostics
                    .hasMemoryIssues ? (
                    <div>
                      <div className="text-red-600 font-medium mb-1">
                        ⚠️ Out of Memory Issues Detected
                      </div>
                      {healthStatus.diagnostics.memoryDiagnostics.memoryErrors.map(
                        (error, index) => (
                          <div
                            key={index}
                            className="font-mono text-xs bg-red-50 p-1 mb-1 rounded"
                          >
                            {error}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-green-600">
                      ✓ No memory issues detected in console output
                    </div>
                  )}
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
