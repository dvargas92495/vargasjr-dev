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
      
      await this.deleteBranch();
      
      console.log(`✅ Cleanup completed for PR ${this.config.prNumber}`);
      
    } catch (error) {
      console.error(`❌ Failed to cleanup agent: ${error}`);
      process.exit(1);
    }
  }

  async getPRDetails(): Promise<{ repository: string; branch: string } | null> {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepository = process.env.GITHUB_REPOSITORY;
    
    if (!githubToken || !githubRepository) {
      console.log("⚠️  Missing GITHUB_TOKEN or GITHUB_REPOSITORY environment variables");
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${githubRepository}/pulls/${this.config.prNumber}`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VargasJR-Cleanup-Agent'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch PR details: ${response.status}`);
        return null;
      }

      const prData = await response.json();
      return {
        repository: githubRepository,
        branch: prData.head.ref
      };
    } catch (error) {
      console.error(`❌ Error fetching PR details: ${error}`);
      return null;
    }
  }

  async deleteBranch(): Promise<void> {
    const prDetails = await this.getPRDetails();
    
    if (!prDetails) {
      console.log("⚠️  Skipping branch deletion - unable to fetch PR details");
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.log("⚠️  Skipping branch deletion - missing GitHub token");
      return;
    }

    console.log(`Deleting branch: ${prDetails.branch} from repository: ${prDetails.repository}`);
    
    try {
      const response = await fetch(`https://api.github.com/repos/${prDetails.repository}/git/refs/heads/${prDetails.branch}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VargasJR-Cleanup-Agent'
        }
      });

      if (response.ok) {
        console.log(`✅ Branch ${prDetails.branch} deleted successfully`);
      } else if (response.status === 404) {
        console.log(`⚠️  Branch ${prDetails.branch} not found (may have been already deleted)`);
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to delete branch ${prDetails.branch}: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting branch ${prDetails.branch}: ${error}`);
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
    console.error("Note: Requires GITHUB_TOKEN and GITHUB_REPOSITORY environment variables");
    process.exit(1);
  }
  
  if (!/^\d+$/.test(prNumber)) {
    console.error("PR number must be a valid number");
    process.exit(1);
  }

  const cleanup = new VargasJRAgentCleanup({ prNumber });
  await cleanup.cleanupAgent();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
