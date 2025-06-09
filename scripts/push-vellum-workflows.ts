#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

class VellumWorkflowPusher {
  private agentDir: string;

  constructor() {
    this.agentDir = join(process.cwd(), "agent");
  }

  async pushWorkflows(): Promise<void> {
    console.log("🚀 Pushing Vellum workflows...");
    
    try {
      if (!existsSync(this.agentDir)) {
        throw new Error("Agent directory not found. Make sure you're running this from the project root.");
      }

      const workflowsDir = join(this.agentDir, "src", "workflows");
      if (!existsSync(workflowsDir)) {
        throw new Error("Workflows directory not found at agent/src/workflows");
      }

      const workflowDirs = this.getWorkflowDirectories(workflowsDir);
      
      if (workflowDirs.length === 0) {
        console.log("⚠️  No workflow directories found");
        return;
      }

      console.log(`📁 Found ${workflowDirs.length} workflow(s): ${workflowDirs.join(", ")}`);

      const failures: string[] = [];

      for (const workflowName of workflowDirs) {
        const result = await this.pushWorkflow(workflowName);
        if (!result.success && result.error) {
          failures.push(result.error);
        }
      }

      await this.displayLockFile();

      if (failures.length > 0) {
        console.error(`\n❌ Failed to push ${failures.length} workflow(s):`);
        failures.forEach(failure => console.error(`  - ${failure}`));
        process.exit(1);
      }

      console.log("✅ All workflows pushed successfully!");

    } catch (error) {
      console.error(`❌ Failed to push workflows: ${error}`);
      process.exit(1);
    }
  }

  private getWorkflowDirectories(workflowsDir: string): string[] {
    try {
      return readdirSync(workflowsDir)
        .filter(item => {
          const itemPath = join(workflowsDir, item);
          return statSync(itemPath).isDirectory();
        })
        .sort();
    } catch (error) {
      throw new Error(`Failed to read workflows directory: ${error}`);
    }
  }

  private async pushWorkflow(workflowName: string): Promise<{success: boolean, error?: string}> {
    console.log(`📤 Pushing workflow: ${workflowName}`);
    
    try {
      const command = `poetry run vellum workflows push "src.workflows.${workflowName}"`;
      
      execSync(command, {
        cwd: this.agentDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          VELLUM_API_KEY: process.env.VELLUM_API_KEY
        }
      });
      
      console.log(`✅ Successfully pushed: ${workflowName}`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to push workflow ${workflowName}: ${error}`;
      console.error(`❌ ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async displayLockFile(): Promise<void> {
    const lockFilePath = join(this.agentDir, "vellum.lock.json");
    
    if (existsSync(lockFilePath)) {
      console.log("\n📄 Generated vellum.lock.json:");
      console.log("=".repeat(50));
      
      try {
        execSync(`cat "${lockFilePath}"`, { stdio: 'inherit' });
      } catch (error) {
        console.error(`Failed to display lock file: ${error}`);
      }
      
      console.log("=".repeat(50));
    } else {
      console.log("\n⚠️  No vellum.lock.json file found");
    }
  }
}

async function main() {
  const pusher = new VellumWorkflowPusher();
  await pusher.pushWorkflows();
}

if (require.main === module) {
  main().catch(console.error);
}
