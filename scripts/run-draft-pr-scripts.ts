#!/usr/bin/env npx tsx

import { execSync, spawn } from "child_process";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, extname, relative } from "path";
import { postGitHubComment, getAddedFilesInPR } from "./utils";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";

interface ScriptResult {
  scriptPath: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

class DraftPRScriptRunner {
  private branchName: string;
  private prNumber?: string;
  private projectRoot: string;
  private isPreviewMode: boolean;

  constructor(isPreviewMode: boolean = false) {
    this.projectRoot = process.cwd();
    this.branchName = this.getCurrentBranch();
    this.isPreviewMode = isPreviewMode;
  }

  private getCurrentBranch(): string {
    try {
      const branchName = execSync("git branch --show-current", {
        cwd: this.projectRoot,
        encoding: "utf8",
      }).trim();

      if (!branchName) {
        throw new Error("Could not determine current branch name");
      }

      return branchName;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  async runScripts(): Promise<void> {
    if (this.isPreviewMode) {
      console.log(`🔍 Previewing scripts for branch: ${this.branchName}`);
    } else {
      console.log(`🔍 Running scripts for branch: ${this.branchName}`);
    }

    try {
      this.prNumber = await this.findPRByBranch();

      const scripts = await this.discoverScripts();

      if (scripts.length === 0) {
        const message = "No executable scripts found in this PR";

        await this.postComment(
          `# Draft PR Script Execution\n\n⚠️ ${message}\n\n` +
            "**Script Discovery Rules:**\n" +
            "- Looks for the first added file (`.js`, `.ts`, `.py`, `.sh`) in the root `scripts/` directory\n" +
            "- Files must be executable or have recognized extensions\n" +
            "- Only considers newly added files, not modified files\n\n" +
            "To add a script, create an executable file in the root `scripts/` directory in your PR"
        );
        return;
      }

      console.log(
        `📁 Found ${scripts.length} script(s): ${scripts.join(", ")}`
      );

      const results: ScriptResult[] = [];

      for (const scriptPath of scripts) {
        const result = await this.runScript(scriptPath);
        results.push(result);
      }

      await this.postResults(results);
    } catch (error) {
      console.error(`❌ Failed to run scripts: ${error}`);
      await this.postComment(
        `# Draft PR Script Execution\n\n❌ **Error**: ${error}\n\nScript execution failed. Please check the workflow logs for more details.`
      );
      process.exit(1);
    }
  }

  private async discoverScripts(): Promise<string[]> {
    try {
      const addedFiles = await this.getAddedFilesInPR();
      const scriptsRootFiles = addedFiles.filter((file) => {
        const parts = file.split("/");
        return (
          parts.length === 2 &&
          parts[0] === "scripts" &&
          this.isExecutableScript(file) &&
          !file.includes("run-draft-pr-scripts.ts")
        );
      });

      if (scriptsRootFiles.length === 0) {
        return [];
      }

      scriptsRootFiles.sort();
      return [scriptsRootFiles[0]];
    } catch (error) {
      console.warn(`⚠️ Could not discover scripts: ${error}`);
      return [];
    }
  }

  private async findPRByBranch(): Promise<string> {
    console.log(`🔍 Finding PR for branch: ${this.branchName}...`);

    const githubRepo = "dvargas92495/vargasjr-dev";

    const [owner, repo] = githubRepo.split("/");
    const headFilter = `${owner}:${this.branchName}`;

    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/pulls?head=${headFilter}&state=open`,
        {
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const prs = await response.json();

      if (prs.length === 0) {
        throw new Error(`No open PRs found for branch: ${this.branchName}`);
      }

      if (prs.length > 1) {
        throw new Error(
          `Multiple open PRs found for branch: ${this.branchName}. Expected exactly one.`
        );
      }

      const pr = prs[0];

      if (!pr.draft) {
        throw new Error(
          `PR #${pr.number} for branch ${this.branchName} is not a draft PR`
        );
      }

      console.log(
        `✅ Found draft PR #${pr.number} for branch: ${this.branchName}`
      );
      console.log(
        `✅ Found PR #${pr.number}, using current HEAD for script discovery`
      );
      return pr.number.toString();
    } catch (error) {
      throw new Error(
        `Failed to find PR for branch ${this.branchName}: ${error}`
      );
    }
  }

  private async getAddedFilesInPR(): Promise<string[]> {
    return getAddedFilesInPR(this.prNumber);
  }

  private getExecutableFiles(dir: string): string[] {
    try {
      return readdirSync(dir)
        .filter((file) => {
          const filePath = join(dir, file);
          return statSync(filePath).isFile() && this.isExecutableScript(file);
        })
        .sort();
    } catch (error) {
      console.warn(`Could not read directory ${dir}: ${error}`);
      return [];
    }
  }

  private isExecutableScript(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    const executableExtensions = [".js", ".ts", ".py", ".sh", ".mjs"];

    if (executableExtensions.includes(ext)) {
      return true;
    }

    try {
      const fullPath = join(this.projectRoot, filePath);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf8");
        return content.startsWith("#!");
      }
    } catch (error) {}

    return false;
  }

  private async runScript(scriptPath: string): Promise<ScriptResult> {
    const fullPath = join(this.projectRoot, scriptPath);
    const startTime = Date.now();

    console.log(
      `🚀 ${
        this.isPreviewMode ? "Running in preview mode" : "Running"
      } script: ${scriptPath}`
    );

    return new Promise((resolve) => {
      const command = this.getExecutionCommand(scriptPath);
      const [cmd, ...args] = command.split(" ");

      let output = "";
      let errorOutput = "";

      const child = spawn(cmd, args, {
        cwd: this.projectRoot,
        stdio: ["inherit", "pipe", "pipe"],
        env: {
          ...process.env,
          PR_NUMBER: this.prNumber || "",
        },
        timeout: 120000,
      });

      const timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        console.error(
          `❌ Script execution timed out after 2 minutes: ${scriptPath}`
        );
      }, 120000);

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        process.stdout.write(text);
        output += text;
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        process.stderr.write(text);
        errorOutput += text;
      });

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (code === 0) {
          console.log(
            `✅ Successfully executed: ${scriptPath} (${duration}ms)`
          );
          resolve({
            scriptPath,
            success: true,
            output: output.trim(),
            duration,
          });
        } else {
          const errorMessage = `Process exited with code ${code}`;
          console.error(
            `❌ Failed to execute: ${scriptPath} - ${errorMessage}`
          );
          resolve({
            scriptPath,
            success: false,
            error: errorMessage,
            output: (output + errorOutput).trim(),
            duration,
          });
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        const errorMessage = error.message || "Unknown error";
        console.error(`❌ Failed to execute: ${scriptPath} - ${errorMessage}`);
        console.error(`❌ Error details:`, error);
        resolve({
          scriptPath,
          success: false,
          error: errorMessage,
          output: (output + errorOutput).trim(),
          duration,
        });
      });
    });
  }

  private getExecutionCommand(scriptPath: string): string {
    const ext = extname(scriptPath).toLowerCase();
    const fullPath = join(this.projectRoot, scriptPath);
    const previewFlag = this.isPreviewMode ? " --preview" : "";

    switch (ext) {
      case ".js":
      case ".mjs":
        return `node ${fullPath}${previewFlag}`;
      case ".ts":
        return `npx tsx ${fullPath}${previewFlag}`;
      case ".py":
        return `python ${fullPath}${previewFlag}`;
      case ".sh":
        return `bash ${fullPath}${previewFlag}`;
      default:
        return `${fullPath}${previewFlag}`;
    }
  }

  private async postResults(results: ScriptResult[]): Promise<void> {
    let commentContent = `# Draft PR Script ${
      this.isPreviewMode ? "Preview" : "Execution Results"
    }\n\n`;
    commentContent += `**PR**: #${this.prNumber}\n`;
    commentContent += `**Mode**: ${
      this.isPreviewMode
        ? "🔍 Preview (scripts run with --preview flag)"
        : "🚀 Execution"
    }\n`;
    commentContent += `**${this.isPreviewMode ? "Previewed" : "Executed"}**: ${
      results.length
    } script(s)\n`;
    commentContent += `**Timestamp**: ${new Date().toISOString()}\n\n`;

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      commentContent += `## ✅ Successful Scripts (${successful.length})\n\n`;
      for (const result of successful) {
        commentContent += `### \`${result.scriptPath}\`\n`;
        commentContent += `**Duration**: ${result.duration}ms\n\n`;
        if (result.output) {
          commentContent += "**Output**:\n```\n";
          commentContent += result.output.substring(0, 2000); // Limit output length
          if (result.output.length > 2000) {
            commentContent += "\n... (output truncated)";
          }
          commentContent += "\n```\n\n";
        }
      }
    }

    if (failed.length > 0) {
      commentContent += `## ❌ Failed Scripts (${failed.length})\n\n`;
      for (const result of failed) {
        commentContent += `### \`${result.scriptPath}\`\n`;
        commentContent += `**Duration**: ${result.duration}ms\n`;
        commentContent += `**Error**: ${result.error}\n\n`;
        if (result.output) {
          commentContent += "**Output**:\n```\n";
          commentContent += result.output.substring(0, 1000);
          if (result.output.length > 1000) {
            commentContent += "\n... (output truncated)";
          }
          commentContent += "\n```\n\n";
        }
      }
    }

    commentContent += `---\n*Script execution completed at ${new Date().toLocaleString()}*`;

    await this.postComment(commentContent);

    if (failed.length > 0) {
      console.error(`\n❌ ${failed.length} script(s) failed execution`);
      process.exit(1);
    } else {
      console.log(
        `\n✅ All ${successful.length} script(s) executed successfully!`
      );
    }
  }

  private async postComment(content: string): Promise<void> {
    const githubRepo = "dvargas92495/vargasjr-dev";

    if (!this.prNumber) {
      console.log("⚠️ No PR number available, skipping comment posting");
      return;
    }

    process.env.GITHUB_EVENT_NAME = "pull_request";
    process.env.GITHUB_EVENT_PATH = "/tmp/github_event.json";

    const eventData = {
      number: parseInt(this.prNumber),
      pull_request: {
        number: parseInt(this.prNumber),
      },
    };

    require("fs").writeFileSync(
      "/tmp/github_event.json",
      JSON.stringify(eventData)
    );

    await postGitHubComment(
      content,
      "vargasjr-dev-draft-pr-script-runner",
      `Posted script execution results to PR #${this.prNumber}`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);

  let isPreviewMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--preview") {
      isPreviewMode = true;
    }
  }

  const runner = new DraftPRScriptRunner(isPreviewMode);
  await runner.runScripts();
}

if (require.main === module) {
  main().catch(console.error);
}
