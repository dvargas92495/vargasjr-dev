import { z } from "zod";
import { cookies } from "next/headers";
import { EC2 } from "@aws-sdk/client-ec2";
import { AGENT_SERVER_PORT, AWS_DEFAULT_REGION } from "@/server/constants";
import { withApiWrapper } from "@/utils/api-wrapper";
import { UnauthorizedError } from "@/server/errors";

const agentLogsSchema = z.object({
  instanceId: z.string(),
});

interface LogFile {
  exists: boolean;
  empty?: boolean;
  totalLines?: number;
  lines?: string[];
  error?: string;
}

interface AgentLogsResult {
  instanceId: string;
  status: "success" | "error" | "offline";
  logs?: Record<string, LogFile>;
  error?: string;
  source?: "agent-server" | "aws-ec2" | "next-api";
  timestamp: string;
}

async function fetchAgentLogs(
  instanceId: string,
  region: string = AWS_DEFAULT_REGION
): Promise<AgentLogsResult> {
  const ec2 = new EC2({ region });
  try {
    const instanceResult = await ec2.describeInstances({
      InstanceIds: [instanceId],
    });

    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      return {
        instanceId,
        status: "offline",
        error: "Instance not found",
        source: "aws-ec2",
        timestamp: new Date().toISOString(),
      };
    }

    if (instance.State?.Name !== "running") {
      return {
        instanceId,
        status: "offline",
        error: `Instance is ${instance.State?.Name}`,
        source: "aws-ec2",
        timestamp: new Date().toISOString(),
      };
    }

    const publicIp = instance.PublicIpAddress;
    if (!publicIp) {
      return {
        instanceId,
        status: "offline",
        error: "Instance has no public IP address",
        source: "aws-ec2",
        timestamp: new Date().toISOString(),
      };
    }

    const logsUrl = `http://${publicIp}:${AGENT_SERVER_PORT}/api/logs`;
    console.log(`[Agent Logs] Making HTTP request to: ${logsUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(logsUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          instanceId,
          status: "error",
          error: `Agent Server returned HTTP ${response.status}: ${errorText}`,
          source: "agent-server",
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();
      return {
        instanceId,
        status: "success",
        logs: data.logs || {},
        timestamp: new Date().toISOString(),
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return {
          instanceId,
          status: "error",
          error: "Agent logs request timed out after 10 seconds",
          source: "agent-server",
          timestamp: new Date().toISOString(),
        };
      }

      const errMsg =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      return {
        instanceId,
        status: "error",
        error: `HTTP request to Agent Server failed: ${errMsg}`,
        source: "agent-server",
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      instanceId,
      status: "error",
      error: `Failed to get instance details from AWS: ${
        error instanceof Error ? error.message : String(error)
      }`,
      source: "aws-ec2",
      timestamp: new Date().toISOString(),
    };
  }
}

async function agentLogsHandler(body: unknown) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new UnauthorizedError();
  }

  const { instanceId } = agentLogsSchema.parse(body);
  const result = await fetchAgentLogs(instanceId);
  return result;
}

export const POST = withApiWrapper(agentLogsHandler);
