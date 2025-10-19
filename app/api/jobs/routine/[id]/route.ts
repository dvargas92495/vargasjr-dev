import { NextResponse } from "next/server";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { eq } from "drizzle-orm";
import { EC2 } from "@aws-sdk/client-ec2";
import {
  AGENT_SERVER_PORT,
  AWS_DEFAULT_REGION,
  DEFAULT_PRODUCTION_AGENT_NAME,
} from "@/server/constants";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { cronExpression } = body;

    if (!cronExpression) {
      return NextResponse.json(
        { error: "cronExpression is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const existingJob = await db
      .select()
      .from(RoutineJobsTable)
      .where(eq(RoutineJobsTable.id, id))
      .limit(1);

    if (existingJob.length === 0) {
      return NextResponse.json(
        { error: "Routine job not found" },
        { status: 404 }
      );
    }

    const updatedJob = await db
      .update(RoutineJobsTable)
      .set({ cronExpression })
      .where(eq(RoutineJobsTable.id, id))
      .returning()
      .execute();

    try {
      const ec2 = new EC2({ region: AWS_DEFAULT_REGION });

      const instancesResult = await ec2.describeInstances({
        Filters: [
          {
            Name: "tag:Name",
            Values: [DEFAULT_PRODUCTION_AGENT_NAME],
          },
          {
            Name: "instance-state-name",
            Values: ["running"],
          },
        ],
      });

      const instance = instancesResult.Reservations?.[0]?.Instances?.[0];

      if (instance?.PublicIpAddress) {
        const reloadUrl = `http://${instance.PublicIpAddress}:${AGENT_SERVER_PORT}/api/reload-jobs`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(reloadUrl, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
            },
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            console.log("Successfully reloaded routine jobs on agent");
          } else {
            console.warn(`Failed to reload jobs on agent: ${response.status}`);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.warn("Failed to notify agent of job update:", fetchError);
        }
      } else {
        console.log("No running production agent found to reload jobs");
      }
    } catch (error) {
      console.warn("Failed to reload jobs on agent:", error);
    }

    return NextResponse.json(updatedJob[0]);
  } catch (error) {
    console.error("Failed to update routine job:", error);
    return NextResponse.json(
      {
        error: "Failed to update routine job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
