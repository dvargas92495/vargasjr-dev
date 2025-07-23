"use client";

import React, { useState, useCallback } from "react";
import StopInstanceButton from "@/components/stop-instance-button";
import StartInstanceButton from "@/components/start-instance-button";
import RebootInstanceButton from "@/components/reboot-instance-button";
import HealthStatusIndicator from "@/components/health-status-indicator";
import TransitionalStateRefresh from "@/components/transitional-state-refresh";
import CopyableText from "@/components/copyable-text";

interface InstanceCardProps {
  instance: {
    InstanceId?: string;
    State?: { Name?: string };
    KeyName?: string;
    PublicDnsName?: string;
    InstanceType?: string;
    ImageId?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
  };
}

const InstanceCard = ({ instance }: InstanceCardProps) => {
  const [healthStatus, setHealthStatus] = useState<{status: string, error?: string}>({ status: "loading" });
  
  const instanceState = instance.State?.Name;
  const instanceId = instance.InstanceId;
  const command = `ssh -i ~/.ssh/${instance.KeyName}.pem ubuntu@${instance.PublicDnsName}`;
  const instanceName = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "Name")?.Value || "Unknown";
  const instanceType = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "Type")?.Value || "main";
  const prNumber = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "PRNumber")?.Value;

  const handleHealthStatusChange = useCallback((status: {status: string, error?: string}) => {
    setHealthStatus(status);
  }, []);

  return (
    <div className="border p-4 rounded-lg w-full max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">
        {instanceName} 
        {instanceType === "preview" && prNumber && (
          <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
            PR #{prNumber}
          </span>
        )}
        {instanceType === "main" && (
          <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
            Main
          </span>
        )}
      </h2>
      <div className="space-y-1 text-sm">
        <p>
          Instance ID: <span className="font-mono">{instance.InstanceId}</span>
        </p>
        <p>
          Instance Type: <span className="font-mono">{instance.InstanceType}</span>
        </p>
        <p>
          State: <span className="font-mono">{instanceState}</span>
        </p>
        <p className="flex items-center gap-2">
          Health: 
          <HealthStatusIndicator 
            instanceId={instanceId!}
            publicDns={instance.PublicDnsName || ""}
            keyName={instance.KeyName || ""}
            instanceState={instanceState || ""}
            onHealthStatusChange={handleHealthStatusChange}
          />
        </p>
        <p>
          ImageID: <span className="font-mono">{instance.ImageId}</span>
        </p>
        <p>
          Connect: <CopyableText className="font-mono" text={command} />
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        {instanceState === "running" && instanceId && (
          <StopInstanceButton id={instanceId} />
        )}
        {instanceState === "stopped" && instanceId && (
          <StartInstanceButton id={instanceId} />
        )}
        {instanceState === "running" && instanceId && healthStatus.status === "unhealthy" && (
          <RebootInstanceButton id={instanceId} />
        )}
        {(instanceState === "pending" || instanceState === "stopping" || instanceState === "shutting-down") && (
          <TransitionalStateRefresh />
        )}
      </div>
    </div>
  );
};

export default InstanceCard;
