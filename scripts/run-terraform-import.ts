#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { OneTimeMigrationRunner } from "./utils";

class TerraformImportRunner extends OneTimeMigrationRunner {
  private terraformDir: string;
  private readonly CDKTF_OUT_DIR = "./terraform/cdktf.out/stacks/vargasjr-preview";
  protected migrationName = "terraform import migration";
  protected userAgent = "vargasjr-dev-terraform-import-script";

  constructor(isPreviewMode: boolean = false) {
    super(isPreviewMode);
    this.terraformDir = join(process.cwd(), "terraform");
  }

  protected async runMigration(): Promise<void> {
    await this.synthesizeTerraformConfig();
    await this.generateImportCommands();
  }

  private async synthesizeTerraformConfig(): Promise<void> {
    this.logSection("Synthesizing CDKTF configuration");
    
    try {
      console.log("Running cdktf get to generate providers...");
      execSync(`cd ${this.terraformDir} && npx cdktf get`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log("Running cdktf synth to generate terraform configuration...");
      execSync(`cd ${this.terraformDir} && npx cdktf synth`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error(`Failed to synthesize CDKTF configuration: ${error}`);
    }
  }

  private async generateImportCommands(): Promise<void> {
    this.logSection("Generating terraform import commands");
    
    const importCommands = this.buildImportCommands();
    
    if (importCommands.length === 0) {
      await this.handleNoImportsNeeded();
      return;
    }

    let importContent = "📋 **Terraform import commands to be executed:**\n\n";
    importContent += "```bash\n";
    
    console.log("\n📋 Terraform import commands to be executed:");
    
    for (const command of importCommands) {
      importContent += command + "\n";
      console.log(command);
    }
    
    importContent += "```\n\n";
    importContent += "⚠️ **Important Notes:**\n";
    importContent += "- These commands require AWS credentials to be configured\n";
    importContent += "- Some resource IDs (especially security group IDs) need to be determined from actual AWS resources\n";
    importContent += "- This is a one-time migration to import existing resources into terraform state\n";
    importContent += "- Run these commands from the terraform directory after `cdktf synth`\n\n";
    importContent += "✅ **End of terraform import preview**\n";
    
    if (this.isPreviewMode) {
      await this.postComment(importContent);
    } else {
      console.log("🚀 Executing terraform import commands...");
      await this.executeImportCommands(importCommands);
    }
  }

  private buildImportCommands(): string[] {
    const commands: string[] = [
      "terraform import aws_s3_bucket.MemoryBucket vargas-jr-memory",
      "terraform import aws_s3_bucket.InboxBucket vargas-jr-inbox",
      
      "terraform import aws_s3_bucket_versioning.MemoryBucketVersioning vargas-jr-memory",
      "terraform import aws_s3_bucket_versioning.InboxBucketVersioning vargas-jr-inbox",
      
      "terraform import aws_security_group.SSHSecurityGroup sg-0e88fc3206b3f3021",
      
      "terraform import aws_security_group_rule.SSHIngressRule sg-0e88fc3206b3f3021_ingress_tcp_22_22_0.0.0.0/0",
      "terraform import aws_security_group_rule.AllEgressRule sg-0e88fc3206b3f3021_egress_all_0_0_0.0.0.0/0",
      
      "terraform import aws_ses_domain_identity.DomainIdentity vargasjr.dev",
      "terraform import aws_ses_email_identity.EmailIdentity hello@vargasjr.dev",
      
      "terraform plan"
    ];
    
    return commands;
  }

  private async handleNoImportsNeeded(): Promise<void> {
    const importContent = "✅ **No terraform imports needed**\n\n" +
      "All AWS resources are already managed by terraform or no import commands were generated.\n";
    this.logSuccess("No terraform imports needed - all resources are already managed");
    if (this.isPreviewMode) {
      await this.postComment(importContent);
    }
  }

  private async executeImportCommands(commands: string[]): Promise<void> {
    const cdktfOutPath = join(process.cwd(), this.CDKTF_OUT_DIR);
    
    if (!existsSync(cdktfOutPath)) {
      throw new Error(`CDKTF output directory not found: ${cdktfOutPath}. Run 'cdktf synth' first.`);
    }

    for (const command of commands) {
      try {
        console.log(`Executing: ${command}`);
        execSync(command, {
          stdio: 'inherit',
          cwd: cdktfOutPath
        });
      } catch (error) {
        console.error(`Failed to execute command: ${command}`);
        console.error(`Error: ${error}`);
        throw new Error(`Terraform import failed at command: ${command}`);
      }
    }
    
    this.logSuccess("All terraform import commands executed successfully");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const runner = new TerraformImportRunner(isPreviewMode);
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}
