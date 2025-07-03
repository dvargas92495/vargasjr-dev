#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { join } from "path";
import { OneTimeMigrationRunner } from "./utils";

class TerraformPlanRunner extends OneTimeMigrationRunner {
  protected migrationName = "Terraform Plan";
  protected userAgent = "vargasjr-dev-terraform-script";
  private terraformDir: string;

  constructor(isPreviewMode: boolean = false) {
    super(isPreviewMode);
    this.terraformDir = join(process.cwd(), "terraform");
  }

  protected async runMigration(): Promise<void> {
    this.logSection("Running Terraform Plan");
    
    try {
      process.chdir(this.terraformDir);
      
      this.logSection("Generating CDKTF providers");
      execSync("npx cdktf get", {
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      this.logSection("Synthesizing CDKTF code");
      execSync("npx cdktf synth", {
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      this.logSection("Running Terraform Plan");
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
    
    if (this.isPreviewMode) {
      await this.postComment(commentContent, "Posted Terraform plan comment to PR");
    } else {
      console.log("Plan output:");
      console.log(commentContent);
    }
  }

  private async handleNoChanges(): Promise<void> {
    const commentContent = "# 🏗️ Terraform Plan Results\n\n" +
      "✅ **No infrastructure changes detected**\n\n" +
      "Your Terraform configuration is up to date with the deployed infrastructure.\n\n" +
      "---\n" +
      "*This plan was generated automatically by the Terraform Plan workflow.*\n";
    
    this.logSuccess("No infrastructure changes detected");
    
    if (this.isPreviewMode) {
      await this.postComment(commentContent, "Posted Terraform plan comment to PR");
    }
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
    
    this.logError("Terraform plan failed");
    
    if (this.isPreviewMode) {
      await this.postComment(commentContent, "Posted Terraform plan error comment to PR");
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
  
  const runner = new TerraformPlanRunner(isPreviewMode);
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}
