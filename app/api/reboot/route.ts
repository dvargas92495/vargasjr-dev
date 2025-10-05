import { z } from "zod";
import { cookies } from "next/headers";
import { EC2 } from "@aws-sdk/client-ec2";
import { AGENT_SERVER_PORT, AWS_DEFAULT_REGION } from "@/server/constants";
import { withApiWrapper } from "@/utils/api-wrapper";
import { UnauthorizedError } from "@/server/errors";

const rebootSchema = z.object({
  instanceId: z.string(),
});

export const POST = withApiWrapper(async (body: unknown) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new UnauthorizedError();
  }

  const { instanceId } = rebootSchema.parse(body);

  const ec2 = new EC2({ region: AWS_DEFAULT_REGION });

  const instanceResult = await ec2.describeInstances({
    InstanceIds: [instanceId],
  });

  const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
  if (!instance) {
    throw new Error("Instance not found");
  }

  if (instance.State?.Name !== "running") {
    throw new Error(`Instance is ${instance.State?.Name}`);
  }

  const publicIp = instance.PublicIpAddress;
  if (!publicIp) {
    throw new Error("Instance has no public IP address");
  }

  const rebootUrl = `http://${publicIp}:${AGENT_SERVER_PORT}/api/reboot`;
  console.log(`[Reboot] Making HTTP request to: ${rebootUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(rebootUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `Agent Server returned HTTP ${response.status}`
      );
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Agent reboot initiated",
      timestamp: data.timestamp,
    };
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      throw new Error("Reboot request timed out after 30 seconds");
    }

    const errMsg =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`HTTP request to Agent Server failed: ${errMsg}`);
  }
});
