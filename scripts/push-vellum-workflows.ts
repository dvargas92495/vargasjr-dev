#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join } from "path";

class VellumWorkflowPusher {
  private agentDir: string;
  private isPreviewMode: boolean;

  constructor(isPreviewMode: boolean = false) {
    this.agentDir = join(process.cwd(), "agent");
    this.isPreviewMode = isPreviewMode;
  }

  async pushWorkflows(): Promise<void> {
    if (this.isPreviewMode) {
      console.log("🔍 Previewing Vellum workflows...");
    } else {
      console.log("🚀 Pushing Vellum workflows...");
    }
    
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
      const outputs: string[] = [];

      for (const workflowName of workflowDirs) {
        const result = await this.pushWorkflow(workflowName);
        if (!result.success && result.error) {
          failures.push(result.error);
        }
        if (result.output) {
          outputs.push(`=== ${workflowName} ===\n${result.output}\n`);
        }
      }

      if (!this.isPreviewMode) {
        await this.displayLockFile();
      }

      if (failures.length > 0) {
        const action = this.isPreviewMode ? "preview" : "push";
        console.error(`\n❌ Failed to ${action} ${failures.length} workflow(s):`);
        failures.forEach(failure => console.error(`  - ${failure}`));
        process.exit(1);
      }

      if (this.isPreviewMode) {
        console.log("✅ All workflows previewed successfully!");
        
        let commentContent = "# Vellum Workflow Preview\n\n";
        commentContent += `Found ${workflowDirs.length} workflow(s): ${workflowDirs.join(", ")}\n\n`;
        
        if (outputs.length > 0) {
          commentContent += "## Dry-run Results\n\n";
          commentContent += "```\n";
          commentContent += outputs.join("\n");
          commentContent += "```\n\n";
        }
        
        commentContent += "⚠️  **NOTE**: These workflows were NOT pushed to Vellum\n";
        commentContent += "This is a preview-only run for pull request review\n";
        commentContent += "✅ Workflow preview completed successfully!";
        
        await this.postGitHubComment(commentContent);
      } else {
        console.log("✅ All workflows pushed successfully!");
      }

    } catch (error) {
      const action = this.isPreviewMode ? "preview" : "push";
      console.error(`❌ Failed to ${action} workflows: ${error}`);
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

  private async pushWorkflow(workflowName: string): Promise<{success: boolean, error?: string, output?: string}> {
    const action = this.isPreviewMode ? "Previewing" : "Pushing";
    console.log(`📤 ${action} workflow: ${workflowName}`);
    
    try {
      const dryRunFlag = this.isPreviewMode ? " --dry-run" : "";
      const command = `poetry run vellum workflows push "src.workflows.${workflowName}"${dryRunFlag}`;
      
      const result = execSync(command, {
        cwd: this.agentDir,
        stdio: this.isPreviewMode ? 'pipe' : 'inherit',
        encoding: 'utf8',
        env: {
          ...process.env,
          VELLUM_API_KEY: process.env.VELLUM_API_KEY
        }
      });
      
      const successMessage = `✅ Successfully ${this.isPreviewMode ? 'previewed' : 'pushed'}: ${workflowName}`;
      console.log(successMessage);
      return { success: true, output: this.isPreviewMode ? result : undefined };
    } catch (error) {
      const errorMessage = `Failed to ${this.isPreviewMode ? 'preview' : 'push'} workflow ${workflowName}: ${error}`;
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

  private async postGitHubComment(content: string): Promise<void> {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY;
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;

    if (!githubToken || !githubRepo || eventName !== 'pull_request' || !eventPath) {
      console.log("Not in PR context or missing GitHub environment variables, skipping comment");
      return;
    }

    try {
      const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
      const prNumber = eventData.number;

      if (!prNumber) {
        console.log("No PR number found in event data");
        return;
      }

      const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "vargasjr-dev-vellum-script"
        },
        body: JSON.stringify({
          body: content
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      console.log("✅ Posted Vellum workflow preview comment to PR");
    } catch (error) {
      console.error("Failed to post GitHub comment:", error);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const pusher = new VellumWorkflowPusher(isPreviewMode);
  await pusher.pushWorkflows();
}

if (require.main === module) {
  main().catch(console.error);
}
