import { NextResponse } from "next/server";
import { EC2 } from "@aws-sdk/client-ec2";
import { AWS_DEFAULT_REGION } from "@/server/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[/api/instances/[id]] GET request for instance: ${id}`);

    const ec2 = new EC2({
      region: AWS_DEFAULT_REGION,
    });

    const result = await ec2.describeInstances({
      InstanceIds: [id],
    });

    const instances =
      result.Reservations?.flatMap((r) => r.Instances || []) || [];
    const instance = instances[0] || null;

    if (!instance || !instance.InstanceId) {
      console.log(`[/api/instances/[id]] Instance ${id} not found`);
      return NextResponse.json(
        {
          error: instance
            ? `Instance data incomplete - missing required fields`
            : `Instance with ID "${id}" not found.`,
        },
        { status: 404 }
      );
    }

    console.log(`[/api/instances/[id]] Successfully fetched instance ${id}`);
    return NextResponse.json({ instance });
  } catch (error) {
    console.error(`[/api/instances/[id]] Failed to fetch instance:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: "Failed to fetch instance details", details: errorMessage },
      { status: 500 }
    );
  }
}
