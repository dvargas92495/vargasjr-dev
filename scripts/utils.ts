#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";

export interface EC2Instance {
  InstanceId?: string;
  State?: { Name?: string };
  Tags?: Array<{ Key?: string; Value?: string }>;
}

export class EC2Utils {
  private ec2: EC2;

  constructor(region: string = "us-east-1") {
    this.ec2 = new EC2({ region });
  }

  async findInstancesByFilters(filters: Array<{ Name: string; Values: string[] }>): Promise<EC2Instance[]> {
    const result = await this.ec2.describeInstances({ Filters: filters });
    return result.Reservations?.flatMap(r => r.Instances || []) || [];
  }

  async terminateInstances(instanceIds: string[]): Promise<void> {
    if (instanceIds.length === 0) return;
    
    await this.ec2.terminateInstances({ InstanceIds: instanceIds });
  }

  async waitForInstancesTerminated(instanceIds: string[], maxAttempts: number = 30): Promise<void> {
    if (instanceIds.length === 0) return;

    console.log("Waiting for instances to be terminated...");
    
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const result = await this.ec2.describeInstances({ InstanceIds: instanceIds });
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

  async deleteKeyPair(keyPairName: string): Promise<void> {
    try {
      console.log(`Deleting key pair: ${keyPairName}`);
      
      await this.ec2.deleteKeyPair({ KeyName: keyPairName });
      
      console.log(`✅ Key pair ${keyPairName} deleted`);
    } catch (error: any) {
      if (error.name === "InvalidKeyPair.NotFound") {
        console.log(`⚠️  Key pair ${keyPairName} not found, skipping deletion`);
      } else {
        throw error;
      }
    }
  }
}
