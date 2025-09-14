import InstanceCard from "@/components/instance-card";
import CreateAgentButton from "@/components/create-agent-button";
import ApprovePRButton from "@/components/approve-pr-button";
import { EC2 } from "@aws-sdk/client-ec2";
import { getEnvironmentPrefix, getPRNumber } from "@/app/api/constants";
import TransitionalStateRefresh from "@/components/transitional-state-refresh";
import { AWS_DEFAULT_REGION } from "@/server/constants";
import {
  checkLocalAgentHealth,
  createLocalAgentInstance,
} from "@/server/health-check";
import Link from "next/link";
import { HomeIcon } from "@heroicons/react/24/outline";

async function checkWorkflowStatus() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3002";
    const url = `${baseUrl}/api/check-workflow-status`;

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data;
    } else if (response.status === 401) {
      console.log(
        "Workflow status check: Authentication required (expected in local dev)"
      );
      return { hasRunningWorkflow: false };
    } else {
      console.error(
        `Workflow status check failed: ${response.status} ${response.statusText}`
      );
      return { hasRunningWorkflow: false };
    }
  } catch (error) {
    console.error("Failed to check workflow status:", error);
    return { hasRunningWorkflow: false };
  }
}

export default async function AdminPage() {
  const ec2 = new EC2({
    region: AWS_DEFAULT_REGION,
  });

  const environmentPrefix = getEnvironmentPrefix();
  let currentPRNumber: string | undefined;
  let prNumberError: string | null = null;

  if (environmentPrefix !== "") {
    try {
      currentPRNumber = await getPRNumber();
    } catch (error) {
      console.error("Failed to get PR number:", error);
      prNumberError =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while getting PR number";
    }
  }

  const postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

  const workflowStatus = await checkWorkflowStatus();

  const scrubPassword = (url: string | undefined) =>
    url ? url.replace(/:[^:@]*@/, ":***@") : "Not set";

  const scrubbedPostgresUrl = scrubPassword(postgresUrl);

  if (environmentPrefix === "PREVIEW" && !currentPRNumber) {
    return (
      <div className="flex flex-col gap-4 justify-start items-start">
        <h1 className="text-2xl font-bold">Vargas JR</h1>
        <p className="text-sm text-gray-700">Manage Vargas Jr Settings</p>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-yellow-800 mb-2">
            Environment Info
          </h3>
          <div className="text-sm font-mono space-y-1 text-gray-700">
            <div>
              <strong>Environment:</strong> {environmentPrefix || "PRODUCTION"}
            </div>
            <div>
              <strong>Current PR Number:</strong>{" "}
              {currentPRNumber ||
                (prNumberError ? `ERROR: ${prNumberError}` : "undefined")}
            </div>
            <div>
              <strong>Postgres URL:</strong> {scrubbedPostgresUrl}
            </div>
            <div>
              <strong>Total Instances Found:</strong> 0
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-2">
            No Instances Available
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Preview environments require a valid PR number to show instances.
          </p>
          <div className="text-sm text-gray-700">
            <p>
              Current environment is in preview mode but no PR number was
              detected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filters = [
    { Name: "tag:Project", Values: ["VargasJR"] },
    {
      Name: "instance-state-name",
      Values: ["running", "stopped", "pending", "stopping", "shutting-down"],
    },
  ];

  if (environmentPrefix === "") {
    filters.push({ Name: "tag:Type", Values: ["main"] });
  } else if (environmentPrefix === "PREVIEW" && currentPRNumber) {
    filters.push({ Name: "tag:PRNumber", Values: [currentPRNumber] });
  }

  let instances: Array<{
    InstanceId?: string;
    State?: { Name?: string };
    KeyName?: string;
    PublicDnsName?: string;
    InstanceType?: string;
    ImageId?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
  }> = [];
  let errorMessage: string | null = null;

  if (environmentPrefix === "DEV") {
    try {
      const localAgentCheck = await checkLocalAgentHealth();

      if (localAgentCheck.isRunning) {
        instances = [createLocalAgentInstance()];
      }
    } catch (error) {
      console.error("Failed to check local agent:", error);
      errorMessage = `Failed to check local agent: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
    }
  } else {
    try {
      instances = await ec2
        .describeInstances({ Filters: filters })
        .then(
          (data) => data.Reservations?.flatMap((r) => r.Instances || []) || []
        );

      if (instances.length === 0 && environmentPrefix === "") {
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
  }

  return (
    <div className="flex flex-col gap-4 justify-start items-start">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Vargas JR</h1>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <HomeIcon className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
      <p className="text-sm text-gray-700">Manage Vargas Jr Settings</p>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg w-full max-w-2xl">
        <h3 className="font-semibold text-yellow-800 mb-2">Environment Info</h3>
        <div className="text-sm font-mono space-y-1 text-gray-700">
          <div>
            <strong>Environment:</strong> {environmentPrefix || "PRODUCTION"}
          </div>
          {environmentPrefix !== "" && (
            <div className="flex items-center gap-2">
              <span>
                <strong>Current PR Number:</strong>{" "}
                {currentPRNumber ||
                  (prNumberError ? `ERROR: ${prNumberError}` : "undefined")}
              </span>
              {environmentPrefix === "PREVIEW" && currentPRNumber && (
                <ApprovePRButton prNumber={currentPRNumber} />
              )}
            </div>
          )}
          <div>
            <strong>Postgres URL:</strong> {scrubbedPostgresUrl}
          </div>
          <div>
            <strong>Total Instances Found:</strong> {instances.length}
          </div>
        </div>
      </div>

      {prNumberError && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-red-800 mb-2">
            Environment Configuration Error
          </h3>
          <p className="text-sm text-red-600 mb-3">
            Failed to determine PR number due to missing or invalid environment
            variables.
          </p>
          <div className="text-sm text-red-500 font-mono bg-red-100 p-2 rounded">
            {prNumberError}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Required for PR environments:</strong> GitHub App
              authentication (GITHUB_APP_ID, GITHUB_PRIVATE_KEY,
              GITHUB_INSTALLATION_ID) and VERCEL_GIT_COMMIT_REF must be properly
              configured.
            </p>
          </div>
        </div>
      )}

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
          {environmentPrefix === "" && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800 mb-3">
                <strong>Production Environment:</strong> You can still create a
                production agent even without AWS credentials configured
                locally.
              </p>
              <CreateAgentButton initialWorkflowState={workflowStatus} />
            </div>
          )}
        </div>
      ) : instances.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-2">
            No Instances Found
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            No EC2 instances were found matching the current environment
            filters.
          </p>
          <div className="text-sm text-gray-700">
            <p>
              <strong>Expected tags:</strong>
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>
                Project: VargasJR (or Name: vargas-jr for legacy instances)
              </li>
              {environmentPrefix === "" && <li>Type: main</li>}
              {environmentPrefix === "PREVIEW" && currentPRNumber && (
                <li>PRNumber: {currentPRNumber}</li>
              )}
              <li>
                State: running, stopped, pending, stopping, or shutting-down
              </li>
            </ul>
          </div>
          {(environmentPrefix === "" ||
            (environmentPrefix === "PREVIEW" && currentPRNumber)) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800 mb-3">
                <strong>
                  {environmentPrefix === "PREVIEW"
                    ? `Preview Environment (PR #${currentPRNumber})`
                    : "Production Environment"}
                  :
                </strong>{" "}
                {environmentPrefix === "PREVIEW"
                  ? `No preview instances are currently running for this PR. You can create a preview agent using the button below.`
                  : `No production instances are currently running. You can create a production agent using the button below.`}
              </p>
              <CreateAgentButton initialWorkflowState={workflowStatus} />
            </div>
          )}
        </div>
      ) : (
        instances.map((instance) => (
          <InstanceCard key={instance.InstanceId} instance={instance} />
        ))
      )}
      {instances.some((instance) =>
        ["pending", "stopping", "shutting-down"].includes(
          instance.State?.Name || ""
        )
      ) && <TransitionalStateRefresh />}
    </div>
  );
}
