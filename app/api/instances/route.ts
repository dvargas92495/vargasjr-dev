import { z } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { cookies } from "next/headers";
import { terminateInstances, deleteKeyPair } from "@/scripts/utils";
import { AWS_DEFAULT_REGION } from "@/server/constants";
import { withApiWrapper } from "@/utils/api-wrapper";
import { UnauthorizedError, NotFoundError } from "@/server/errors";

const instanceSchema = z.object({
  id: z.string(),
  operation: z.enum(["STOP", "START", "DELETE"]),
});

async function instancesHandler(body: unknown) {
  console.log(`[/api/instances] POST request received`);

  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");
  console.log(`[/api/instances] Admin token present: ${!!token?.value}`);

  if (token?.value !== process.env.ADMIN_TOKEN) {
    console.log(`[/api/instances] Authentication failed - token mismatch`);
    throw new UnauthorizedError();
  }

  console.log(`[/api/instances] Request body:`, body);
  const { id, operation } = instanceSchema.parse(body);
  console.log(
    `[/api/instances] Parsed - Instance ID: ${id}, Operation: ${operation}`
  );

  console.log(`[/api/instances] Initializing EC2 client for region us-east-1`);
  const ec2 = new EC2({ region: AWS_DEFAULT_REGION });

  if (operation === "STOP") {
    console.log(`[/api/instances] Stopping instance ${id}`);
    const result = await ec2.stopInstances({ InstanceIds: [id] });
    console.log(`[/api/instances] Stop command result:`, result);
    return {
      success: true,
      message: "Instance stop initiated",
      result,
    };
  } else if (operation === "START") {
    console.log(`[/api/instances] Starting instance ${id}`);
    const result = await ec2.startInstances({ InstanceIds: [id] });
    console.log(`[/api/instances] Start command result:`, result);
    return {
      success: true,
      message: "Instance start initiated",
      result,
    };
  } else if (operation === "DELETE") {
    console.log(`[/api/instances] Deleting instance ${id}`);

    const instanceResult = await ec2.describeInstances({ InstanceIds: [id] });
    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
    const instanceName = instance?.Tags?.find(
      (tag) => tag.Key === "Name"
    )?.Value;

    await terminateInstances(ec2, [id]);
    console.log(`[/api/instances] Instance ${id} termination initiated`);

    if (instanceName) {
      const keyPairName = `${instanceName}-key`;
      await deleteKeyPair(ec2, keyPairName);
      console.log(
        `[/api/instances] Key pair ${keyPairName} deletion attempted`
      );
    }

    return {
      success: true,
      message: "Instance deletion initiated",
    };
  }

  console.log(`[/api/instances] Invalid operation: ${operation}`);
  throw new NotFoundError("Invalid operation");
}

export const POST = withApiWrapper(instancesHandler);
