import { cookies } from "next/headers";
import { EC2, Instance } from "@aws-sdk/client-ec2";
import { checkInstanceHealth } from "@/scripts/utils";
import { AWS_DEFAULT_REGION } from "@/server/constants";
import { getGitHubAuthHeaders } from "../../lib/github-auth";
import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";

async function checkWorkflowFailure(creationStartTime: number) {
  try {
    const headers = await getGitHubAuthHeaders();

    const creationDate = new Date(creationStartTime).toISOString();
    const response = await fetch(
      `https://api.github.com/repos/dvargas92495/vargasjr-dev/actions/runs?branch=main&event=workflow_dispatch&status=failure&created=>=${creationDate}`,
      { headers }
    );

    if (response.ok) {
      const data = await response.json();
      const failedWorkflows =
        data.workflow_runs?.filter(
          (run: { path: string; created_at: string; status: string }) =>
            run.path === ".github/workflows/create-production-agent.yaml" &&
            new Date(run.created_at).getTime() >= creationStartTime
        ) || [];

      if (failedWorkflows.length > 0) {
        return {
          failed: true,
          message: "Agent creation workflow failed. Please try again.",
        };
      }
    }
  } catch (error) {
    console.error("Failed to check workflow status:", error);
  }

  return { failed: false };
}

const agentStatusSchema = z.object({
  creationStartTime: z.number(),
});

async function checkAgentStatusHandler(body: unknown) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new Error("Unauthorized");
  }

  const { creationStartTime } = agentStatusSchema.parse(body);

  const workflowStatus = await checkWorkflowFailure(creationStartTime);
  if (workflowStatus.failed) {
    return {
      status: "error",
      message: workflowStatus.message,
    };
  }

  const timeoutMs = 20 * 60 * 1000;
  if (Date.now() - creationStartTime > timeoutMs) {
    return {
      status: "error",
      message:
        "Agent creation timed out. The workflow may have failed or is taking too long.",
    };
  }

  const ec2 = new EC2({ region: AWS_DEFAULT_REGION });

  let result = await ec2.describeInstances({
    Filters: [
      { Name: "tag:Project", Values: ["VargasJR"] },
      { Name: "tag:Type", Values: ["main"] },
      {
        Name: "instance-state-name",
        Values: ["running", "stopped", "pending", "stopping", "shutting-down"],
      },
    ],
  });

  let instances: Instance[] =
    result.Reservations?.flatMap((r) => r.Instances || []) || [];
  if (instances.length === 0) {
    result = await ec2.describeInstances({
      Filters: [
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
      ],
    });
    instances = result.Reservations?.flatMap((r) => r.Instances || []) || [];
  }

  const recentInstances = instances.filter((instance) => {
    const launchTime = instance.LaunchTime;
    return launchTime && new Date(launchTime).getTime() > creationStartTime;
  });

  if (recentInstances.length === 0) {
    return {
      status: "creating",
      message: "Agent instance is being created...",
    };
  }

  const latestInstance = recentInstances.sort(
    (a, b) =>
      new Date(b.LaunchTime!).getTime() - new Date(a.LaunchTime!).getTime()
  )[0];

  const instanceState = latestInstance.State?.Name;

  if (instanceState === "pending") {
    return {
      status: "booting",
      message: "Agent instance is starting up...",
      instanceId: latestInstance.InstanceId,
    };
  }

  if (instanceState === "running") {
    try {
      await checkInstanceHealth(latestInstance.InstanceId!);
      return {
        status: "ready",
        message: "Agent is online and ready!",
        instanceId: latestInstance.InstanceId,
      };
    } catch {
      return {
        status: "booting",
        message: "Agent is starting services...",
        instanceId: latestInstance.InstanceId,
      };
    }
  }

  return {
    status: "error",
    message: `Agent instance is in ${instanceState} state`,
    instanceId: latestInstance.InstanceId,
  };
}

export const POST = withApiWrapper(checkAgentStatusHandler);
