#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, extname, relative } from "path";
import { postGitHubComment } from "./utils";

interface ScriptResult {
  scriptPath: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

class DraftPRScriptRunner {
  private prNumber: string;
  private specificScriptPath?: string;
  private projectRoot: string;

  constructor(prNumber: string, specificScriptPath?: string) {
    this.prNumber = prNumber;
    this.specificScriptPath = specificScriptPath;
    this.projectRoot = process.cwd();
  }

  async runScripts(): Promise<void> {
    console.log(`🔍 Running scripts for draft PR #${this.prNumber}`);
    
    try {
      const scripts = this.specificScriptPath 
        ? [this.specificScriptPath]
        : await this.discoverScripts();
      
      if (scripts.length === 0) {
        const message = this.specificScriptPath 
          ? `Script not found: ${this.specificScriptPath}`
          : "No executable scripts found in this PR";
        
        await this.postComment(`# Draft PR Script Execution\n\n⚠️ ${message}\n\n` +
          "**Script Discovery Rules:**\n" +
          "- Looks for executable files (`.js`, `.ts`, `.py`, `.sh`) in changed files\n" +
          "- Checks for scripts in `scripts/one-time/` directory\n" +
          "- Files must be executable or have recognized extensions\n\n" +
          "To add a script, create an executable file in your PR changes or add it to `scripts/one-time/`");
        return;
      }

      console.log(`📁 Found ${scripts.length} script(s): ${scripts.join(", ")}`);

      const results: ScriptResult[] = [];
      
      for (const scriptPath of scripts) {
        const result = await this.runScript(scriptPath);
        results.push(result);
      }

      await this.postResults(results);

    } catch (error) {
      console.error(`❌ Failed to run scripts: ${error}`);
      await this.postComment(`# Draft PR Script Execution\n\n❌ **Error**: ${error}\n\nScript execution failed. Please check the workflow logs for more details.`);
      process.exit(1);
    }
  }

  private async discoverScripts(): Promise<string[]> {
    const scripts: string[] = [];
    
    const oneTimeDir = join(this.projectRoot, "scripts", "one-time");
    if (existsSync(oneTimeDir)) {
      const oneTimeScripts = this.getExecutableFiles(oneTimeDir);
      scripts.push(...oneTimeScripts.map(s => join("scripts", "one-time", s)));
    }

    try {
      const changedFiles = this.getChangedFilesInPR();
      const executableChanged = changedFiles.filter(file => this.isExecutableScript(file));
      scripts.push(...executableChanged);
    } catch (error) {
      console.warn(`⚠️ Could not get changed files from PR: ${error}`);
    }

    const uniqueScripts = [...new Set(scripts)];
    return uniqueScripts.filter(script => existsSync(join(this.projectRoot, script)));
  }

  private getChangedFilesInPR(): string[] {
    try {
      const output = execSync(`git diff --name-only origin/main...HEAD`, {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      console.warn(`Could not get git diff: ${error}`);
      return [];
    }
  }

  private getExecutableFiles(dir: string): string[] {
    try {
      return readdirSync(dir)
        .filter(file => {
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
    const executableExtensions = ['.js', '.ts', '.py', '.sh', '.mjs'];
    
    if (executableExtensions.includes(ext)) {
      return true;
    }

    try {
      const fullPath = join(this.projectRoot, filePath);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8');
        return content.startsWith('#!');
      }
    } catch (error) {
    }

    return false;
  }

  private async runScript(scriptPath: string): Promise<ScriptResult> {
    const fullPath = join(this.projectRoot, scriptPath);
    const startTime = Date.now();
    
    console.log(`🚀 Running script: ${scriptPath}`);
    
    try {
      const command = this.getExecutionCommand(scriptPath);
      
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          PR_NUMBER: this.prNumber
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Successfully executed: ${scriptPath} (${duration}ms)`);
      
      return {
        scriptPath,
        success: true,
        output: output.trim(),
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorOutput = error.stdout || error.stderr || '';
      
      console.error(`❌ Failed to execute: ${scriptPath} - ${errorMessage}`);
      
      return {
        scriptPath,
        success: false,
        error: errorMessage,
        output: errorOutput.trim(),
        duration
      };
    }
  }

  private getExecutionCommand(scriptPath: string): string {
    const ext = extname(scriptPath).toLowerCase();
    const fullPath = join(this.projectRoot, scriptPath);
    
    switch (ext) {
      case '.js':
      case '.mjs':
        return `node "${fullPath}"`;
      case '.ts':
        return `npx tsx "${fullPath}"`;
      case '.py':
        return `python "${fullPath}"`;
      case '.sh':
        return `bash "${fullPath}"`;
      default:
        return `"${fullPath}"`;
    }
  }

  private async postResults(results: ScriptResult[]): Promise<void> {
    let commentContent = `# Draft PR Script Execution Results\n\n`;
    commentContent += `**PR**: #${this.prNumber}\n`;
    commentContent += `**Executed**: ${results.length} script(s)\n`;
    commentContent += `**Timestamp**: ${new Date().toISOString()}\n\n`;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

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
      console.log(`\n✅ All ${successful.length} script(s) executed successfully!`);
    }
  }

  private async postComment(content: string): Promise<void> {
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.GITHUB_EVENT_PATH = '/tmp/github_event.json';
    
    const eventData = {
      number: parseInt(this.prNumber),
      pull_request: {
        number: parseInt(this.prNumber)
      }
    };
    
    require('fs').writeFileSync('/tmp/github_event.json', JSON.stringify(eventData));
    
    await postGitHubComment(
      content,
      "vargasjr-dev-draft-pr-script-runner",
      `Posted script execution results to PR #${this.prNumber}`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  let prNumber: string | undefined;
  let scriptPath: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pr' && i + 1 < args.length) {
      prNumber = args[i + 1];
      i++;
    } else if (args[i] === '--script-path' && i + 1 < args.length) {
      scriptPath = args[i + 1];
      i++;
    }
  }
  
  if (!prNumber) {
    console.error('❌ PR number is required. Use --pr <number>');
    process.exit(1);
  }
  
  const runner = new DraftPRScriptRunner(prNumber, scriptPath);
  await runner.runScripts();
}

if (require.main === module) {
  main().catch(console.error);
}
