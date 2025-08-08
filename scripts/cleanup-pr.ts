#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { findInstancesByFilters, terminateInstances, deleteKeyPair, deleteSecret } from "./utils";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";

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
        console.log(`ℹ️ No instances found for PR ${this.config.prNumber} - this is expected if no preview agent was created`);
        console.log(`⚠️ Skipping instance termination and key pair deletion - no instances found`);
      } else {
        const instanceIds = instances
          .map(instance => instance.InstanceId)
          .filter((id): id is string => !!id);

        if (instanceIds.length > 0) {
          console.log(`Terminating instances: ${instanceIds.join(", ")}`);
          await terminateInstances(this.ec2, instanceIds);
          console.log(`✅ Instances terminated: ${instanceIds.join(", ")}`);
        }

        await deleteKeyPair(this.ec2, `pr-${this.config.prNumber}-key`);
      }
      
      const secretName = `vargasjr-pr-${this.config.prNumber}-key-pem`;
      await deleteSecret(secretName, this.config.region);
      
      await this.deleteNeonBranch();
      
      await this.deleteBranch();
      
      await this.archiveDevinSession();
      
      console.log(`✅ Cleanup completed for PR ${this.config.prNumber}`);
      
    } catch (error) {
      console.error(`❌ Failed to cleanup agent: ${error}`);
      process.exit(1);
    }
  }

  async getPRDetails(): Promise<{ repository: string; branch: string } | null> {
    const githubRepository = "dvargas92495/vargasjr-dev";

    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(`https://api.github.com/repos/${githubRepository}/pulls/${this.config.prNumber}`, {
        headers: {
          ...headers,
          'User-Agent': 'VargasJR-Cleanup-PR'
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

  async deleteNeonBranch(): Promise<void> {
    const neonApiKey = process.env.NEON_API_KEY;
    const projectId = "fancy-sky-34733112";
    
    if (!neonApiKey) {
      console.log("⚠️  Skipping Neon branch deletion - missing NEON_API_KEY");
      return;
    }

    const prDetails = await this.getPRDetails();
    if (!prDetails) {
      console.log("⚠️  Skipping Neon branch deletion - unable to fetch PR details");
      return;
    }

    const fullBranchName = `preview/${prDetails.branch}`;
    console.log(`Deleting Neon branch: ${fullBranchName}`);
    
    try {
      const branchResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches`, {
        headers: {
          "Authorization": `Bearer ${neonApiKey}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!branchResponse.ok) {
        console.error(`❌ Failed to fetch Neon branches: ${branchResponse.status}`);
        return;
      }
      
      const branchData = await branchResponse.json();
      const branch = branchData.branches?.find((b: any) => b.name === fullBranchName);
      
      if (!branch) {
        console.log(`⚠️  Neon branch ${fullBranchName} not found (may have been already deleted)`);
        return;
      }
      
      const branchId = branch.id;
      console.log(`Found Neon branch ID: ${branchId}`);
      
      const deleteResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${neonApiKey}`,
          "Content-Type": "application/json"
        }
      });
      
      if (deleteResponse.ok) {
        console.log(`✅ Neon branch ${fullBranchName} deleted successfully`);
      } else if (deleteResponse.status === 204) {
        console.log(`✅ Neon branch ${fullBranchName} was already deleted`);
      } else {
        const errorText = await deleteResponse.text();
        console.error(`❌ Failed to delete Neon branch ${fullBranchName}: ${deleteResponse.status} ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting Neon branch ${fullBranchName}: ${error}`);
    }
  }

  async deleteBranch(): Promise<void> {
    const prDetails = await this.getPRDetails();
    
    if (!prDetails) {
      console.log("⚠️  Skipping branch deletion - unable to fetch PR details");
      return;
    }

    console.log(`Deleting branch: ${prDetails.branch} from repository: ${prDetails.repository}`);
    
    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(`https://api.github.com/repos/${prDetails.repository}/git/refs/heads/${prDetails.branch}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'User-Agent': 'VargasJR-Cleanup-PR'
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

  async archiveDevinSession(): Promise<void> {
    const prDetails = await this.getPRDetails();
    
    if (!prDetails) {
      console.log("⚠️  Skipping Devin session archival - unable to fetch PR details");
      return;
    }

    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(`https://api.github.com/repos/${prDetails.repository}/pulls/${this.config.prNumber}`, {
        headers: {
          ...headers,
          'User-Agent': 'VargasJR-Cleanup-PR'
        }
      });

      if (!response.ok) {
        console.log(`⚠️  Failed to fetch PR body for session archival: ${response.status}`);
        return;
      }

      const prData = await response.json();
      const prBody = prData.body || '';
      
      const sessionUrlRegex = /https:\/\/app\.devin\.ai\/sessions\/([a-f0-9-]+)/i;
      const match = prBody.match(sessionUrlRegex);
      
      if (!match) {
        console.log("ℹ️  No Devin session URL found in PR description - skipping session archival");
        return;
      }

      const sessionId = match[1];
      console.log(`Found Devin session ID: ${sessionId}`);
      
      await this.archiveSession(sessionId);
      
    } catch (error) {
      console.error(`❌ Error during Devin session archival: ${error}`);
    }
  }

  private async archiveSession(sessionId: string): Promise<void> {
    const devinApiToken = process.env.DEVIN_API_TOKEN;
    
    if (!devinApiToken) {
      console.log("⚠️  Skipping Devin session archival - missing DEVIN_API_TOKEN");
      return;
    }

    try {
      console.log(`Sending archive message to Devin session: ${sessionId}`);
      
      const response = await fetch(`https://api.devin.ai/v1/session/${sessionId}/message`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${devinApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "archive"
        })
      });

      if (response.ok) {
        console.log(`✅ Archive message sent to Devin session ${sessionId}`);
      } else {
        const errorText = await response.text();
        const errorMessage = `❌ Failed to send archive message to Devin session ${sessionId}: ${response.status} ${errorText}`;
        if (response.status >= 500) {
          const headers = Object.fromEntries(response.headers.entries());
          console.error(errorMessage);
          console.error(`Response headers:`, headers);
        } else {
          console.error(errorMessage);
        }
      }
    } catch (error) {
      console.error(`❌ Error sending archive message to Devin session ${sessionId}: ${error}`);
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
    console.error("Usage: npx tsx scripts/cleanup-pr.ts --pr <pr-number>");
    console.error("Example: npx tsx scripts/cleanup-pr.ts --pr 123");
    console.error("Note: Requires GitHub App configuration");
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
