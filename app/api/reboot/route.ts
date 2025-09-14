import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { EC2 } from "@aws-sdk/client-ec2";
import { AGENT_SERVER_PORT, AWS_DEFAULT_REGION } from "@/server/constants";

const rebootSchema = z.object({
  instanceId: z.string(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instanceId } = rebootSchema.parse(body);

    const ec2 = new EC2({ region: AWS_DEFAULT_REGION });
    
    try {
      const instanceResult = await ec2.describeInstances({
        InstanceIds: [instanceId],
      });

      const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
      if (!instance) {
        return NextResponse.json(
          { error: "Instance not found" },
          { status: 404 }
        );
      }

      if (instance.State?.Name !== "running") {
        return NextResponse.json(
          { error: `Instance is ${instance.State?.Name}` },
          { status: 400 }
        );
      }

      const publicIp = instance.PublicIpAddress;
      if (!publicIp) {
        return NextResponse.json(
          { error: "Instance has no public IP address" },
          { status: 400 }
        );
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
          const errorText = await response.text();
          return NextResponse.json(
            {
              error: `Agent Server returned HTTP ${response.status}: ${errorText}`,
            },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          message: data.message || "Agent reboot initiated",
          timestamp: data.timestamp,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return NextResponse.json(
            { error: "Reboot request timed out after 30 seconds" },
            { status: 408 }
          );
        }

        const errMsg =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        return NextResponse.json(
          { error: `HTTP request to Agent Server failed: ${errMsg}` },
          { status: 500 }
        );
      }
    } catch (awsError) {
      const errorMessage =
        awsError instanceof Error ? awsError.message : "AWS error";
      return NextResponse.json(
        { error: `Failed to get instance details: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Reboot failed" }, { status: 500 });
  }
}
