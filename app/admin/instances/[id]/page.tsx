import { EC2 } from "@aws-sdk/client-ec2";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import StopInstanceButton from "@/components/stop-instance-button";
import StartInstanceButton from "@/components/start-instance-button";
import RebootInstanceButton from "@/components/reboot-instance-button";
import DeleteInstanceButton from "@/components/delete-instance-button";
import HealthStatusIndicator from "@/components/health-status-indicator";
import BrowserSessionsIndicator from "@/components/browser-sessions-indicator";
import CopyableText from "@/components/copyable-text";
import { AWS_DEFAULT_REGION } from "@/server/constants";

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ec2 = new EC2({
    region: AWS_DEFAULT_REGION,
  });

  let instance: {
    InstanceId?: string;
    State?: { Name?: string };
    KeyName?: string;
    PublicDnsName?: string;
    InstanceType?: string;
    ImageId?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
  } | null = null;
  let errorMessage: string | null = null;

  try {
    const result = await ec2.describeInstances({
      InstanceIds: [id],
    });

    const instances =
      result.Reservations?.flatMap((r) => r.Instances || []) || [];
    instance = instances[0] || null;

    if (!instance || !instance.InstanceId) {
      errorMessage = instance
        ? `Instance data incomplete - missing required fields`
        : `Instance with ID "${id}" not found.`;
    }
  } catch (error) {
    console.error("Failed to fetch instance:", error);
    errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <button className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold">Instance Details</h1>
        </div>

        <div className="bg-red-50 border border-red-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-red-800 mb-2">
            Unable to Load Instance
          </h3>
          <p className="text-sm text-red-600 mb-3">
            Failed to fetch instance details. This is likely due to missing AWS
            credentials or the instance not existing.
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
      </div>
    );
  }

  const instanceState = instance?.State?.Name;
  const instanceId = instance?.InstanceId;
  const command =
    instance?.KeyName && instance?.PublicDnsName
      ? `ssh -i ~/.ssh/${instance.KeyName}.pem ubuntu@${instance.PublicDnsName}`
      : "Connection details not available";
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
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold">
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
        </h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Instance ID
            </label>
            <p className="mt-1 text-sm text-gray-900 font-mono">
              {instance?.InstanceId || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Instance Type
            </label>
            <p className="mt-1 text-sm text-gray-900 font-mono">
              {instance?.InstanceType || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              State
            </label>
            <p className="mt-1 text-sm text-gray-900 font-mono">
              {instanceState || "Unknown"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Health
            </label>
            <div className="mt-1 flex items-center gap-2">
              {instanceId ? (
                <HealthStatusIndicator
                  instanceId={instanceId}
                  publicDns={instance?.PublicDnsName || ""}
                  keyName={instance?.KeyName || ""}
                  instanceState={instanceState || ""}
                />
              ) : (
                <span className="text-gray-500">N/A</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Image ID
            </label>
            <p className="mt-1 text-sm text-gray-900 font-mono">
              {instance?.ImageId || "N/A"}
            </p>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Connect Command
            </label>
            <div className="mt-1">
              <CopyableText className="font-mono text-sm" text={command} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Actions</h3>
        <div className="flex gap-2">
          {instanceState === "running" && instanceId && (
            <StopInstanceButton id={instanceId} />
          )}
          {instanceState === "stopped" && instanceId && (
            <>
              <StartInstanceButton id={instanceId} />
              <DeleteInstanceButton
                id={instanceId}
                instanceName={instanceName}
              />
            </>
          )}
          {instanceState === "running" && instanceId && (
            <RebootInstanceButton id={instanceId} />
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Browser Sessions</h3>
        {instanceId ? (
          <BrowserSessionsIndicator
            instanceId={instanceId}
            instanceState={instanceState || ""}
          />
        ) : (
          <div className="text-sm text-gray-500">
            Browser Sessions: <span className="text-gray-400">N/A</span>
          </div>
        )}
      </div>
    </div>
  );
}
