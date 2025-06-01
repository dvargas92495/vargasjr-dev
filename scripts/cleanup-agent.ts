#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { findInstancesByFilters, terminateInstances, deleteKeyPair } from "./utils";

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
      const instances = await findInstancesByFilters(this.ec2, [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:PRNumber", Values: [this.config.prNumber] },
        { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
      ]);
      
      if (instances.length === 0) {
        console.log(`No instances found for PR ${this.config.prNumber}`);
        return;
      }
      
      const instanceIds = instances
        .map(instance => instance.InstanceId)
        .filter((id): id is string => !!id);

      if (instanceIds.length > 0) {
        console.log(`Terminating instances: ${instanceIds.join(", ")}`);
        await terminateInstances(this.ec2, instanceIds);
        console.log(`✅ Instances terminated: ${instanceIds.join(", ")}`);
      }

      await deleteKeyPair(this.ec2, `pr-${this.config.prNumber}-key`);
      
      console.log(`✅ Cleanup completed for PR ${this.config.prNumber}`);
      
    } catch (error) {
      console.error(`❌ Failed to cleanup agent: ${error}`);
      process.exit(1);
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
