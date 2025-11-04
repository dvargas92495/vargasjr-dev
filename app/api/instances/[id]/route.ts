import { EC2 } from "@aws-sdk/client-ec2";
import { AWS_DEFAULT_REGION } from "@/server/constants";
import { withApiWrapper } from "@/utils/api-wrapper";
import { NotFoundError } from "@/server/errors";

async function handler(body: { id: string }) {
  const { id } = body;
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
    throw new NotFoundError(
      instance
        ? `Instance data incomplete - missing required fields`
        : `Instance with ID "${id}" not found.`
    );
  }

  console.log(`[/api/instances/[id]] Successfully fetched instance ${id}`);
  return { instance };
}

export const GET = withApiWrapper(handler);
