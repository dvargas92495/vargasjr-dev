#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { execSync } from "child_process";

class AMIDebugMigration extends OneTimeMigrationRunner {
  protected migrationName = "AWS AMI Creation Debug";
  protected userAgent = "vargasjr-dev-ami-debug-migration";

  protected async runMigration(): Promise<void> {
    this.logSection("AWS AMI Creation Debugging");
    
    let debugOutput = "# AWS AMI Creation Debug Results\n\n";
    
    try {
      this.logSection("Checking Image Builder Pipeline");
      const pipelineResult = this.runAWSCommand(
        'aws imagebuilder list-image-pipelines --filters name=name,values=vargasjr-workspace'
      );
      debugOutput += "## Image Builder Pipeline Status\n```json\n" + pipelineResult + "\n```\n\n";
      
      this.logSection("Searching for Custom AMIs");
      const amiResult = this.runAWSCommand(
        'aws ec2 describe-images --owners self --filters "Name=name,Values=vargasjr-workspace*" "Name=state,Values=available"'
      );
      debugOutput += "## Custom AMI Search Results\n```json\n" + amiResult + "\n```\n\n";
      
      this.logSection("Checking All Self-Owned AMIs");
      const allAmisResult = this.runAWSCommand(
        'aws ec2 describe-images --owners self'
      );
      debugOutput += "## All Self-Owned AMIs\n```json\n" + allAmisResult + "\n```\n\n";
      
      this.logSection("Checking Image Builder Components");
      const componentsResult = this.runAWSCommand(
        'aws imagebuilder list-components --filters name=name,values=vargasjr-workspace'
      );
      debugOutput += "## Image Builder Components\n```json\n" + componentsResult + "\n```\n\n";
      
      this.logSection("Checking Image Builder Recipes");
      const recipesResult = this.runAWSCommand(
        'aws imagebuilder list-image-recipes --filters name=name,values=vargasjr-workspace'
      );
      debugOutput += "## Image Builder Recipes\n```json\n" + recipesResult + "\n```\n\n";
      
      this.logSection("Checking Infrastructure Configuration");
      const infraResult = this.runAWSCommand(
        'aws imagebuilder list-infrastructure-configurations --filters name=name,values=vargasjr-infra-config'
      );
      debugOutput += "## Infrastructure Configuration\n```json\n" + infraResult + "\n```\n\n";
      
      this.logSection("Checking Distribution Configuration");
      const distResult = this.runAWSCommand(
        'aws imagebuilder list-distribution-configurations --filters name=name,values=vargasjr-dist-config'
      );
      debugOutput += "## Distribution Configuration\n```json\n" + distResult + "\n```\n\n";
      
      if (!this.isPreviewMode) {
        await this.postComment(debugOutput, "Posted AWS AMI debugging results to PR");
      } else {
        console.log("Preview mode - would post the following comment:");
        console.log(debugOutput);
      }
      
      console.log("=== FULL DEBUG OUTPUT ===");
      console.log(debugOutput);
      
      this.logSuccess("AWS AMI debugging completed successfully");
      
    } catch (error) {
      this.logError(`AWS AMI debugging failed: ${error}`);
      throw error;
    }
  }
  
  private runAWSCommand(command: string): string {
    try {
      this.logSection(`Running: ${command}`);
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env }
      });
      this.logSuccess(`Command completed successfully`);
      console.log(`=== OUTPUT FOR: ${command} ===`);
      console.log(result.trim());
      console.log(`=== END OUTPUT ===`);
      return result.trim();
    } catch (error: any) {
      this.logWarning(`Command failed: ${error.message}`);
      const errorOutput = `Error: ${error.message}\nStderr: ${error.stderr || 'N/A'}`;
      console.log(`=== ERROR FOR: ${command} ===`);
      console.log(errorOutput);
      console.log(`=== END ERROR ===`);
      return errorOutput;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const migration = new AMIDebugMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
