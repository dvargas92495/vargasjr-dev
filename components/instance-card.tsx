"use client";

import React from "react";
import HealthStatusIndicator from "@/components/health-status-indicator";
import TransitionalStateRefresh from "@/components/transitional-state-refresh";
import Link from "next/link";

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
  const instanceState = instance.State?.Name;
  const instanceId = instance.InstanceId;
  const instanceName =
    instance.Tags?.find(
      (tag: { Key?: string; Value?: string }) => tag.Key === "Name"
    )?.Value || "Unknown";
  const instanceType =
    instance.Tags?.find(
      (tag: { Key?: string; Value?: string }) => tag.Key === "Type"
    )?.Value || "main";
  const prNumber = instance.Tags?.find(
    (tag: { Key?: string; Value?: string }) => tag.Key === "PRNumber"
  )?.Value;

  return (
    <div className="border p-4 rounded-lg w-full max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">
        <Link href={`/admin/instances/${instanceId}`} className="hover:text-blue-600 transition-colors">
          {instanceName}
        </Link>
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
          State: <span className="font-mono">{instanceState}</span>
        </p>
        <p className="flex items-center gap-2">
          Health:
          <HealthStatusIndicator
            instanceId={instanceId!}
            publicDns={instance.PublicDnsName || ""}
            keyName={instance.KeyName || ""}
            instanceState={instanceState || ""}
            onHealthStatusChange={() => {}}
          />
        </p>
      </div>
      {(instanceState === "pending" ||
        instanceState === "stopping" ||
        instanceState === "shutting-down") && (
        <div className="mt-3">
          <TransitionalStateRefresh />
        </div>
      )}
    </div>
  );
};

export default InstanceCard;
