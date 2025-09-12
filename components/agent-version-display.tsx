"use client";

import React, { useCallback, useEffect, useState } from "react";

interface AgentVersionDisplayProps {
  instanceId: string;
  publicDns: string;
  keyName: string;
  instanceState: string;
}

const AgentVersionDisplay = ({
  instanceId,
  publicDns,
  keyName,
  instanceState,
}: AgentVersionDisplayProps) => {
  const [version, setVersion] = useState<string>("Loading...");

  const fetchVersion = useCallback(async () => {
    if (instanceState !== "running") {
      setVersion("N/A");
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
        const agentVersion = data.diagnostics?.environment?.agentVersion;
        setVersion(agentVersion || "Unknown");
      } else {
        setVersion("Unknown");
      }
    } catch {
      setVersion("Unknown");
    }
  }, [instanceId, publicDns, keyName, instanceState]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  return (
    <span className="text-sm text-gray-900 font-mono">{version}</span>
  );
};

export default AgentVersionDisplay;
