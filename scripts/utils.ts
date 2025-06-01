import { EC2 } from "@aws-sdk/client-ec2";

export interface EC2Instance {
  InstanceId?: string;
  State?: { Name?: string };
  Tags?: Array<{ Key?: string; Value?: string }>;
}

export async function findInstancesByFilters(ec2: EC2, filters: Array<{ Name: string; Values: string[] }>): Promise<EC2Instance[]> {
  const result = await ec2.describeInstances({ Filters: filters });
  return result.Reservations?.flatMap(r => r.Instances || []) || [];
}

export async function terminateInstances(ec2: EC2, instanceIds: string[]): Promise<void> {
  if (instanceIds.length === 0) return;
  
  await ec2.terminateInstances({ InstanceIds: instanceIds });
}

export async function waitForInstancesTerminated(ec2: EC2, instanceIds: string[], maxAttempts: number = 30): Promise<void> {
  if (instanceIds.length === 0) return;

  console.log("Waiting for instances to be terminated...");
  
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const result = await ec2.describeInstances({ InstanceIds: instanceIds });
      const instances = result.Reservations?.flatMap(r => r.Instances || []) || [];
      
      const stillExists = instances.some(instance => 
        instance.State?.Name !== "terminated" && instance.State?.Name !== "shutting-down"
      );
      
      if (!stillExists) {
        console.log("✅ All instances have been terminated");
        return;
      }
      
      attempts++;
      console.log(`Instances still terminating... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      if (error.name === "InvalidInstanceID.NotFound") {
        console.log("✅ All instances have been terminated");
        return;
      }
      throw error;
    }
  }
  
  throw new Error("Instances failed to terminate within timeout");
}

export async function deleteKeyPair(ec2: EC2, keyPairName: string): Promise<void> {
  try {
    console.log(`Deleting key pair: ${keyPairName}`);
    
    await ec2.deleteKeyPair({ KeyName: keyPairName });
    
    console.log(`✅ Key pair ${keyPairName} deleted`);
  } catch (error: any) {
    if (error.name === "InvalidKeyPair.NotFound") {
      console.log(`⚠️  Key pair ${keyPairName} not found, skipping deletion`);
    } else {
      throw error;
    }
  }
}
