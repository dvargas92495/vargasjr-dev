import React from "react";
import { EC2 } from "@aws-sdk/client-ec2";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import BrowserSessionsIndicator from "@/components/browser-sessions-indicator";
import { AWS_DEFAULT_REGION } from "@/server/constants";

export default async function BrowserSessionsPage() {
  const ec2 = new EC2({
    region: AWS_DEFAULT_REGION,
  });

  const filters = [
    { Name: "tag:Project", Values: ["VargasJR"] },
    {
      Name: "instance-state-name",
      Values: ["running", "stopped", "pending", "stopping", "shutting-down"],
    },
  ];

  let instances: Array<{
    InstanceId?: string;
    State?: { Name?: string };
    Tags?: Array<{ Key?: string; Value?: string }>;
  }> = [];
  let errorMessage: string | null = null;

  try {
    instances = await ec2
      .describeInstances({ Filters: filters })
      .then(
        (data) => data.Reservations?.flatMap((r) => r.Instances || []) || []
      );

    if (instances.length === 0) {
      const legacyFilters = [
        { Name: "tag:Name", Values: ["vargas-jr"] },
        { Name: "tag:Type", Values: ["main"] },
        {
          Name: "instance-state-name",
          Values: [
            "running",
            "stopped",
            "pending",
            "stopping",
            "shutting-down",
          ],
        },
      ];
      instances = await ec2
        .describeInstances({ Filters: legacyFilters })
        .then(
          (data) => data.Reservations?.flatMap((r) => r.Instances || []) || []
        );
    }
  } catch (error) {
    console.error("Failed to query EC2 instances:", error);
    errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold">Browser Sessions</h1>
      </div>

      <p className="text-sm text-gray-700">
        Monitor browser sessions across all Vargas JR instances
      </p>

      {errorMessage ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-red-800 mb-2">
            Unable to Query Instances
          </h3>
          <p className="text-sm text-red-600 mb-3">
            Failed to connect to AWS EC2 service. This is likely due to missing
            or invalid AWS credentials.
          </p>
          <div className="text-sm text-red-500 font-mono bg-red-100 p-2 rounded">
            {errorMessage}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> In production, this page should have proper
              AWS credentials configured to query EC2 instances. This error is
              expected in local development without AWS setup.
            </p>
          </div>
        </div>
      ) : instances.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-2">
            No Instances Found
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            No EC2 instances were found matching the current environment filters.
          </p>
          <div className="text-sm text-gray-700">
            <p>
              <strong>Expected tags:</strong>
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Project: VargasJR (or Name: vargas-jr for legacy instances)</li>
              <li>
                State: running, stopped, pending, stopping, or shutting-down
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {instances.map((instance) => {
            const instanceName =
              instance?.Tags?.find(
                (tag: { Key?: string; Value?: string }) => tag.Key === "Name"
              )?.Value || "Unknown";
            const instanceType =
              instance?.Tags?.find(
                (tag: { Key?: string; Value?: string }) => tag.Key === "Type"
              )?.Value || "main";
            const prNumber = instance?.Tags?.find(
              (tag: { Key?: string; Value?: string }) => tag.Key === "PRNumber"
            )?.Value;

            return (
              <div
                key={instance.InstanceId}
                className="bg-white p-6 rounded-lg shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {instanceName}
                    </h3>
                    {instanceType === "preview" && prNumber && (
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        PR #{prNumber}
                      </span>
                    )}
                    {instanceType === "main" && (
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                        Main
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/admin/instances/${instance.InstanceId}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View Details →
                  </Link>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Instance ID:</span>{" "}
                  <span className="font-mono">{instance.InstanceId}</span>
                  <span className="ml-4 font-medium">State:</span>{" "}
                  <span className="font-mono">{instance.State?.Name}</span>
                </div>
                {instance.InstanceId ? (
                  <BrowserSessionsIndicator
                    instanceId={instance.InstanceId}
                    instanceState={instance.State?.Name || ""}
                  />
                ) : (
                  <div className="text-sm text-gray-700">
                    Browser Sessions: <span className="text-gray-600">N/A</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
