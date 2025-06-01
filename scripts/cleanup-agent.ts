#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";

interface CleanupConfig {
  prNumber: string;
  region?: string;
}

class VargasJRAgentCleanup {
  private ec2: EC2;
  private config: CleanupConfig;

  constructor(config: CleanupConfig) {
    this.config = {
      region: "us-east-1",
      ...config
    };
    this.ec2 = new EC2({ region: this.config.region });
  }

  async cleanupAgent(): Promise<void> {
    console.log(`Cleaning up Vargas JR agent for PR: ${this.config.prNumber}`);
    
    try {
      const instances = await this.findPRInstances();
      
      if (instances.length === 0) {
        console.log(`No instances found for PR ${this.config.prNumber}`);
        return;
      }
      
      for (const instance of instances) {
        await this.terminateInstance(instance.InstanceId!);
        await this.deleteKeyPair(`pr-${this.config.prNumber}-key`);
      }
      
      console.log(`✅ Cleanup completed for PR ${this.config.prNumber}`);
      
    } catch (error) {
      console.error(`❌ Failed to cleanup agent: ${error}`);
      process.exit(1);
    }
  }

  private async findPRInstances() {
    const result = await this.ec2.describeInstances({
      Filters: [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:PRNumber", Values: [this.config.prNumber] },
        { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
      ]
    });

    return result.Reservations?.flatMap(r => r.Instances || []) || [];
  }

  private async terminateInstance(instanceId: string): Promise<void> {
    console.log(`Terminating instance: ${instanceId}`);
    
    await this.ec2.terminateInstances({
      InstanceIds: [instanceId]
    });
    
    console.log(`✅ Instance ${instanceId} terminated`);
  }

  private async deleteKeyPair(keyPairName: string): Promise<void> {
    try {
      console.log(`Deleting key pair: ${keyPairName}`);
      
      await this.ec2.deleteKeyPair({
        KeyName: keyPairName
      });
      
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

async function main() {
  const args = process.argv.slice(2);
  
  let prNumber = "";
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pr" && i + 1 < args.length) {
      prNumber = args[i + 1];
      i++;
    }
  }
  
  if (!prNumber) {
    console.error("Usage: npx tsx scripts/cleanup-agent.ts --pr <pr-number>");
    console.error("Example: npx tsx scripts/cleanup-agent.ts --pr 123");
    process.exit(1);
  }
  
  if (!/^\d+$/.test(prNumber)) {
    console.error("PR number must be a valid number");
    process.exit(1);
  }

  const cleanup = new VargasJRAgentCleanup({ prNumber });
  await cleanup.cleanupAgent();
}

if (require.main === module) {
  main().catch(console.error);
}
