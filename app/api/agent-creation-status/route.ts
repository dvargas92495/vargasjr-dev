import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { EC2, Instance } from "@aws-sdk/client-ec2";
import { checkInstanceHealth } from "@/scripts/utils";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { creationStartTime } = body;

    const ec2 = new EC2({ region: "us-east-1" });

    let result = await ec2.describeInstances({
      Filters: [
        { Name: "tag:Project", Values: ["VargasJR"] },
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
      return NextResponse.json({
        status: "creating",
        message: "Agent instance is being created...",
      });
    }

    const latestInstance = recentInstances.sort(
      (a, b) =>
        new Date(b.LaunchTime!).getTime() - new Date(a.LaunchTime!).getTime()
    )[0];

    const instanceState = latestInstance.State?.Name;

    if (instanceState === "pending") {
      return NextResponse.json({
        status: "booting",
        message: "Agent instance is starting up...",
        instanceId: latestInstance.InstanceId,
      });
    }

    if (instanceState === "running") {
      try {
        await checkInstanceHealth(latestInstance.InstanceId!, "us-east-1");
        return NextResponse.json({
          status: "ready",
          message: "Agent is online and ready!",
          instanceId: latestInstance.InstanceId,
        });
      } catch {
        return NextResponse.json({
          status: "booting",
          message: "Agent is starting services...",
          instanceId: latestInstance.InstanceId,
        });
      }
    }

    return NextResponse.json({
      status: "error",
      message: `Agent instance is in ${instanceState} state`,
      instanceId: latestInstance.InstanceId,
    });
  } catch (error) {
    console.error("Agent creation status check error:", error);
    return NextResponse.json(
      { error: "Failed to check agent status" },
      { status: 500 }
    );
  }
}
