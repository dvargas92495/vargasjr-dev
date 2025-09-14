#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import {
  readdirSync,
  statSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { postGitHubComment } from "./utils";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";

const toTitleCase = (str: string) => {
  return str
    .split("_")
    .map((txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
    .join(" ");
};

class VellumWorkflowPusher {
  private agentDir: string;
  private isPreviewMode: boolean;
  private hasDockerImageBeenPushed: boolean = false;

  constructor(isPreviewMode: boolean = false) {
    this.agentDir = join(process.cwd(), "vellum");
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
        throw new Error(
          "Vellum directory not found. Make sure you're running this from the project root."
        );
      }

      const workflowsDir = join(this.agentDir, "workflows");
      if (!existsSync(workflowsDir)) {
        throw new Error("Workflows directory not found at vellum/workflows");
      }

      if (!this.isPreviewMode) {
        await this.handleServicesChanges();
      }

      const workflowDirs = this.getWorkflowDirectories(workflowsDir);

      if (workflowDirs.length === 0) {
        console.log("⚠️  No workflow directories found");
        return;
      }

      console.log(
        `📁 Found ${workflowDirs.length} workflow(s): ${workflowDirs.join(
          ", "
        )}`
      );

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
        console.error(
          `\n❌ Failed to ${action} ${failures.length} workflow(s):`
        );
        failures.forEach((failure) => console.error(`  - ${failure}`));
        process.exit(1);
      }

      if (this.isPreviewMode) {
        console.log("✅ All workflows previewed successfully!");

        let commentContent = "# Vellum Workflow Preview\n\n";
        commentContent += `Found ${
          workflowDirs.length
        } workflow(s): ${workflowDirs.join(", ")}\n\n`;

        if (outputs.length > 0) {
          commentContent += "## Dry-run Results\n\n";
          commentContent += "```\n";
          commentContent += outputs.join("\n");
          commentContent += "```\n\n";
        }

        commentContent +=
          "⚠️  **NOTE**: These workflows were NOT pushed to Vellum\n";
        commentContent +=
          "This is a preview-only run for pull request review\n";
        commentContent += "✅ Workflow preview completed successfully!";

        await postGitHubComment(
          commentContent,
          "vargasjr-dev-vellum-script",
          "Posted Vellum workflow preview comment to PR"
        );
      } else {
        console.log("✅ All workflows pushed successfully!");

        await this.handleLockFileChanges();
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
        .filter((item) => {
          const itemPath = join(workflowsDir, item);
          return statSync(itemPath).isDirectory();
        })
        .sort();
    } catch (error) {
      throw new Error(`Failed to read workflows directory: ${error}`);
    }
  }

  private async pushWorkflow(
    workflowName: string
  ): Promise<{ success: boolean; error?: string; output?: string }> {
    const action = this.isPreviewMode ? "Previewing" : "Pushing";
    console.log(`📤 ${action} workflow: ${workflowName}`);

    try {
      const deployFlag = this.isPreviewMode
        ? " --dry-run"
        : ` --deploy --deployment-name ${workflowName.replaceAll(
            "_",
            "-"
          )} --deployment-label "${toTitleCase(workflowName)}"`;

      const command = `poetry run vellum workflows push "workflows.${workflowName}"${deployFlag}`;

      const result = execSync(command, {
        cwd: this.agentDir,
        stdio: "pipe",
        encoding: "utf8",
        env: {
          ...process.env,
          VELLUM_API_KEY: process.env.VELLUM_API_KEY,
        },
      });

      const successMessage = `✅ Successfully ${
        this.isPreviewMode ? "previewed" : "pushed"
      }: ${workflowName}`;
      console.log(successMessage);
      return { success: true, output: this.isPreviewMode ? result : undefined };
    } catch (error: any) {
      const errorOutput = (
        error.stdout +
        error.stderr +
        error.message +
        ""
      ).toString();

      if (
        this.isPreviewMode &&
        errorOutput.includes("# Workflow Push Report") &&
        errorOutput.includes("No errors found")
      ) {
        const successMessage = `✅ Successfully previewed: ${workflowName}`;
        console.log(successMessage);
        return { success: true, output: errorOutput };
      }

      console.error(`SDK Version: ${errorOutput.includes("SDK Version")}`);
      console.error(
        `does not match SDK version: ${errorOutput.includes(
          "does not match SDK version"
        )}`
      );
      console.error(
        `within the container image: ${errorOutput.includes(
          "within the container image"
        )}`
      );

      if (
        this.isPreviewMode &&
        errorOutput.includes(
          "dry_run` is only supported when updating an existing Workflow Sandbox"
        )
      ) {
        const warningMessage = `⚠️  Skipping ${workflowName}: dry_run not supported for new workflows`;
        console.log(warningMessage);
        return {
          success: true,
          output: `Skipped: ${workflowName} - dry_run not supported for new workflows`,
        };
      }

      if (
        errorOutput.includes("SDK Version") &&
        errorOutput.includes("does not match SDK version") &&
        errorOutput.includes("within the container image")
      ) {
        console.log(
          `🔄 Detected SDK version mismatch for ${workflowName}, attempting to push new image...`
        );
        const retryResult = await this.handleImageError(
          workflowName,
          errorOutput,
          "sdk_version_mismatch"
        );
        if (retryResult.success) {
          return retryResult;
        }
      }

      console.error(
        `Container image: ${errorOutput.includes("Container image")}`
      );
      console.error(`not found: ${errorOutput.includes("not found")}`);

      if (
        errorOutput.includes("Container image") &&
        errorOutput.includes("not found")
      ) {
        if (this.isPreviewMode) {
          const warningMessage = `⚠️  Skipping ${workflowName}: Container image not found (would be resolved in actual push)`;
          console.log(warningMessage);
          return {
            success: true,
            output: `Skipped: ${workflowName} - Container image not found (would be resolved in actual push)`,
          };
        } else {
          console.log(
            `🔄 Detected missing container image for ${workflowName}, attempting to push existing image...`
          );
          const retryResult = await this.handleImageError(
            workflowName,
            errorOutput,
            "missing_image_tags"
          );
          if (retryResult.success) {
            return retryResult;
          }
        }
      }

      const errorMessage = `Failed to ${
        this.isPreviewMode ? "preview" : "push"
      } workflow ${workflowName}: ${error}`;
      console.error(`❌ ${errorOutput}`);
      return { success: false, error: errorMessage };
    }
  }

  private async displayLockFile(): Promise<void> {
    const lockFilePath = join(this.agentDir, "vellum.lock.json");

    if (existsSync(lockFilePath)) {
      console.log("\n📄 Generated vellum.lock.json:");
      console.log("=".repeat(50));

      try {
        execSync(`cat "${lockFilePath}"`, { stdio: "inherit" });
      } catch (error) {
        console.error(`Failed to display lock file: ${error}`);
      }

      console.log("=".repeat(50));
    } else {
      console.log("\n⚠️  No vellum.lock.json file found");
    }
  }

  private async handleImageError(
    workflowName: string,
    errorOutput: string,
    errorType: "sdk_version_mismatch" | "missing_image_tags"
  ): Promise<{ success: boolean; error?: string; output?: string }> {
    try {
      if (this.hasDockerImageBeenPushed) {
        throw new Error(
          "Docker image push has already been attempted once. Multiple docker image pushes are not allowed."
        );
      }

      if (this.isPreviewMode) {
        throw new Error(
          "Docker image push is not allowed in preview mode. Image errors cannot be resolved in preview."
        );
      }

      const lockFilePath = join(this.agentDir, "vellum.lock.json");
      if (!existsSync(lockFilePath)) {
        throw new Error("vellum.lock.json not found");
      }

      const lockFileContent = JSON.parse(readFileSync(lockFilePath, "utf8"));
      const currentTag =
        lockFileContent.workflows[0]?.container_image_tag || "1.0.0";

      let tagToUse: string;
      if (errorType === "sdk_version_mismatch") {
        tagToUse = this.incrementPatchVersion(currentTag);
        console.log(
          `📦 Pushing new container image with incremented tag: ${tagToUse}`
        );
      } else {
        tagToUse = currentTag;
        console.log(
          `📦 Pushing container image with existing tag: ${tagToUse}`
        );
      }

      const dockerfilePath = join(this.agentDir, "workflows", "Dockerfile");
      const pushImageCommand = `poetry run vellum images push vargasjr:${tagToUse} --source ${dockerfilePath}`;

      execSync(pushImageCommand, {
        cwd: this.agentDir,
        stdio: "pipe",
        env: {
          ...process.env,
          VELLUM_API_KEY: process.env.VELLUM_API_KEY,
        },
      });

      this.hasDockerImageBeenPushed = true;
      console.log(
        `✅ Successfully pushed container image: vargasjr:${tagToUse}`
      );

      if (errorType === "sdk_version_mismatch") {
        this.updateLockFileTag(lockFileContent, tagToUse);
        writeFileSync(lockFilePath, JSON.stringify(lockFileContent, null, 2));
        console.log(`📝 Updated vellum.lock.json with new tag: ${tagToUse}`);
      }

      console.log(`🔄 Retrying workflow push for: ${workflowName}`);
      const retryResult = await this.pushWorkflow(workflowName);

      if (retryResult.success) {
        console.log(
          `✅ Successfully pushed workflow after image update: ${workflowName}`
        );
      }

      return retryResult;
    } catch (error: any) {
      const errorMessage = `Failed to handle image error for ${workflowName}: ${error}`;
      console.error(`❌ ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private incrementPatchVersion(version: string): string {
    const parts = version.split(".");
    if (parts.length !== 3) {
      throw new Error(`Invalid version format: ${version}`);
    }

    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]) + 1;

    return `${major}.${minor}.${patch}`;
  }

  private updateLockFileTag(lockFileContent: any, newTag: string): void {
    if (lockFileContent.workflows && Array.isArray(lockFileContent.workflows)) {
      lockFileContent.workflows.forEach((workflow: any) => {
        if (workflow.container_image_name === "vargasjr") {
          workflow.container_image_tag = newTag;
        }
      });
    }
  }

  private async handleServicesChanges(): Promise<void> {
    try {
      const gitStatus = execSync(
        "git status --porcelain vellum/services/",
        {
          encoding: "utf8",
          cwd: process.cwd(),
        }
      ).trim();

      if (gitStatus) {
        console.log("🔍 Detected changes in vellum/services, building new image...");
        
        const lockFilePath = join(this.agentDir, "vellum.lock.json");
        if (!existsSync(lockFilePath)) {
          console.log("⚠️  No vellum.lock.json found, creating initial version...");
          const initialLockFile = {
            workflows: [{
              container_image_name: "vargasjr",
              container_image_tag: "1.0.0"
            }]
          };
          writeFileSync(lockFilePath, JSON.stringify(initialLockFile, null, 2));
        }

        const lockFileContent = JSON.parse(readFileSync(lockFilePath, "utf8"));
        const currentTag = lockFileContent.workflows[0]?.container_image_tag || "1.0.0";
        const newTag = this.incrementPatchVersion(currentTag);
        
        console.log(`📦 Building and pushing new container image with tag: ${newTag}`);
        
        const dockerfilePath = join(this.agentDir, "workflows", "Dockerfile");
        const pushImageCommand = `poetry run vellum images push vargasjr:${newTag} --source ${dockerfilePath}`;

        execSync(pushImageCommand, {
          cwd: this.agentDir,
          stdio: "pipe",
          env: {
            ...process.env,
            VELLUM_API_KEY: process.env.VELLUM_API_KEY,
          },
        });

        this.hasDockerImageBeenPushed = true;
        console.log(`✅ Successfully pushed container image: vargasjr:${newTag}`);
        
        this.updateLockFileTag(lockFileContent, newTag);
        writeFileSync(lockFilePath, JSON.stringify(lockFileContent, null, 2));
        console.log(`📝 Updated vellum.lock.json with new tag: ${newTag}`);
      } else {
        console.log("ℹ️  No changes detected in vellum/services");
      }
    } catch (error) {
      console.error(`⚠️  Failed to handle services changes: ${error}`);
    }
  }

  private async handleLockFileChanges(): Promise<void> {
    try {
      const gitStatus = execSync(
        "git status --porcelain vellum/vellum.lock.json",
        {
          encoding: "utf8",
          cwd: process.cwd(),
        }
      ).trim();

      if (gitStatus) {
        console.log("🔍 Detected changes in vellum.lock.json, creating PR...");

        try {
          await getGitHubAuthHeaders();
        } catch (authError) {
          console.log(
            "⚠️  Skipping PR creation - GitHub authentication failed"
          );
          console.log(
            "ℹ️  Lock file changes detected but cannot create PR without GitHub App authentication"
          );
          console.error("Authentication error:", authError);
          return;
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const branchName = `devin/${timestamp}-update-vellum-lock-file`;

        execSync(`git checkout -b ${branchName}`, { cwd: process.cwd() });
        execSync("git add vellum/vellum.lock.json", { cwd: process.cwd() });
        execSync(
          'git -c user.name="Devin AI" -c user.email="devin-ai-integration[bot]@users.noreply.github.com" commit -m "Update vellum.lock.json with new workflow changes"',
          { cwd: process.cwd() }
        );
        execSync(`git push origin ${branchName}`, { cwd: process.cwd() });

        const prTitle = "Update vellum.lock.json with new workflow changes";
        const prBody =
          "This PR updates the vellum.lock.json file with new workflow changes to resolve SDK version mismatches.";

        const headers = await getGitHubAuthHeaders();
        const githubToken = headers.Authorization.replace("Bearer ", "");

        execSync(
          `gh pr create --title "${prTitle}" --body "${prBody}" --head ${branchName} --base main`,
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              GITHUB_TOKEN: githubToken,
            },
          }
        );

        console.log(
          `✅ Created PR for lock file changes on branch: ${branchName}`
        );
      } else {
        console.log("ℹ️  No changes detected in vellum.lock.json");
      }
    } catch (error) {
      console.error(`⚠️  Failed to handle lock file changes: ${error}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");

  const pusher = new VellumWorkflowPusher(isPreviewMode);
  await pusher.pushWorkflows();
}

if (require.main === module) {
  main().catch(console.error);
}
