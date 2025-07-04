#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { join } from "path";
import { postGitHubComment } from "./utils";

interface TerraformRunnerOptions {
  isPreviewMode: boolean;
}

class TerraformRunner {
  private terraformDir: string;
  private isPreviewMode: boolean;

  constructor(options: TerraformRunnerOptions) {
    this.isPreviewMode = options.isPreviewMode;
    this.terraformDir = join(process.cwd(), "terraform");
  }

  async run(): Promise<void> {
    console.log(`🔍 ${this.isPreviewMode ? 'Previewing' : 'Running'} Terraform...`);
    
    if (!this.isPreviewMode) {
      console.log("🚀 Terraform apply is coming soon!");
      return;
    }

    try {
      process.chdir(this.terraformDir);
      
      console.log("=== Generating CDKTF providers ===");
      execSync("npx cdktf get", {
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      console.log("=== Synthesizing CDKTF code ===");
      execSync("npx cdktf synth", {
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      console.log("=== Running Terraform Plan ===");
      const planOutput = execSync("npx cdktf diff --no-color", {
        encoding: 'utf8',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      await this.formatAndPostPlanResults(planOutput);
      
    } catch (error: any) {
      if (error.stdout && error.stdout.includes('No changes')) {
        await this.handleNoChanges();
        return;
      }
      
      const errorOutput = error.stdout || error.stderr || error.message;
      await this.handlePlanError(errorOutput);
      throw error;
    }
  }

  private async formatAndPostPlanResults(planOutput: string): Promise<void> {
    let commentContent = "# 🏗️ Terraform Plan Results\n\n";
    
    if (planOutput.includes('No changes')) {
      commentContent += "✅ **No infrastructure changes detected**\n\n";
      commentContent += "Your Terraform configuration is up to date with the deployed infrastructure.\n";
    } else {
      commentContent += "📋 **Infrastructure changes planned:**\n\n";
      commentContent += "```diff\n";
      commentContent += planOutput;
      commentContent += "\n```\n\n";
      
      const summary = this.extractPlanSummary(planOutput);
      if (summary) {
        commentContent += `**Summary:** ${summary}\n\n`;
      }
    }
    
    commentContent += "---\n";
    commentContent += "*This plan was generated automatically by the Terraform Plan workflow.*\n";
    
    await this.postComment(commentContent, "Posted Terraform plan comment to PR");
  }

  private async handleNoChanges(): Promise<void> {
    const commentContent = "# 🏗️ Terraform Plan Results\n\n" +
      "✅ **No infrastructure changes detected**\n\n" +
      "Your Terraform configuration is up to date with the deployed infrastructure.\n\n" +
      "---\n" +
      "*This plan was generated automatically by the Terraform Plan workflow.*\n";
    
    console.log("✅ No infrastructure changes detected");
    await this.postComment(commentContent, "Posted Terraform plan comment to PR");
  }

  private async handlePlanError(errorOutput: string): Promise<void> {
    const commentContent = "# 🏗️ Terraform Plan Results\n\n" +
      "❌ **Terraform plan failed**\n\n" +
      "```\n" +
      errorOutput +
      "\n```\n\n" +
      "Please review the error above and fix any issues in your Terraform configuration.\n\n" +
      "---\n" +
      "*This plan was generated automatically by the Terraform Plan workflow.*\n";
    
    console.log("❌ Terraform plan failed");
    await this.postComment(commentContent, "Posted Terraform plan error comment to PR");
  }

  private async postComment(content: string, successMessage: string): Promise<void> {
    try {
      await postGitHubComment(content, "vargasjr-dev-terraform-script", successMessage);
      console.log(`✅ ${successMessage}`);
    } catch (error) {
      console.log("Not in PR context or missing GitHub environment variables, skipping comment");
    }
  }

  private extractPlanSummary(planOutput: string): string | null {
    const lines = planOutput.split('\n');
    const summaryLine = lines.find(line => 
      line.includes('to add') || 
      line.includes('to change') || 
      line.includes('to destroy')
    );
    return summaryLine?.trim() || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const runner = new TerraformRunner({ isPreviewMode });
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}
