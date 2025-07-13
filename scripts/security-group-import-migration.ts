#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { join } from "path";
import { OneTimeMigrationRunner } from "./utils";

class SecurityGroupImportMigration extends OneTimeMigrationRunner {
  protected migrationName = "Security Group Import Migration";
  protected userAgent = "vargasjr-dev-security-group-import";
  
  private terraformDir: string;
  private readonly SECURITY_GROUP_ID = "sg-0e88fc3206b3f3021";
  private readonly SECURITY_GROUP_RESOURCE = "aws_security_group.SSHSecurityGroup";

  constructor(isPreviewMode: boolean = false) {
    super(isPreviewMode);
    this.terraformDir = join(process.cwd(), "terraform");
  }

  protected async runMigration(): Promise<void> {
    this.logSection("Starting Security Group Import Migration");
    
    if (this.isPreviewMode) {
      await this.previewImport();
    } else {
      await this.executeImport();
    }
  }

  private async previewImport(): Promise<void> {
    this.logSection("Preview Mode - Security Group Import Commands");
    
    const commands = this.buildImportCommands();
    
    let previewContent = "# 🔍 Security Group Import Migration Preview\n\n";
    previewContent += "**Purpose**: Import existing security group to resolve duplicate resource error\n\n";
    previewContent += "**Security Group**: `vargas-jr-ssh-access` (ID: `sg-0e88fc3206b3f3021`)\n\n";
    previewContent += "**Commands that would be executed**:\n\n";
    previewContent += "```bash\n";
    
    for (const command of commands) {
      previewContent += command + "\n";
      console.log(`Would execute: ${command}`);
    }
    
    previewContent += "```\n\n";
    previewContent += "**Notes**:\n";
    previewContent += "- This will import the existing AWS security group into Terraform state\n";
    previewContent += "- The script includes state checking to be idempotent\n";
    previewContent += "- This resolves the 'InvalidGroup.Duplicate' error during terraform apply\n\n";
    previewContent += "✅ **Preview completed** - Run in execution mode to perform the import\n";
    
    await this.postComment(previewContent);
    this.logSuccess("Preview completed successfully");
  }

  private async executeImport(): Promise<void> {
    this.logSection("Executing terraform import commands");
    
    try {
      await this.synthesizeTerraformConfig();
      
      await this.initializeTerraform();
      
      const isAlreadyImported = await this.checkResourceInState();
      
      if (isAlreadyImported) {
        this.logSuccess("Security group is already managed by terraform - skipping import");
        await this.postSuccessComment("already managed");
        return;
      }
      
      await this.importSecurityGroup();
      
      await this.postSuccessComment("imported");
      this.logSuccess("Security group import completed successfully");
      
    } catch (error) {
      this.logError(`Failed to import security group: ${error}`);
      throw error;
    }
  }

  private async synthesizeTerraformConfig(): Promise<void> {
    this.logSection("Generating CDKTF providers");
    
    try {
      execSync("npx cdktf get", {
        stdio: 'inherit',
        cwd: this.terraformDir,
        env: {
          ...process.env,
          VERCEL_ENV: 'preview',
        }
      });
      
      this.logSection("Synthesizing CDKTF code");
      execSync("npx cdktf synth", {
        stdio: 'inherit',
        cwd: this.terraformDir,
        env: {
          ...process.env,
          VERCEL_ENV: 'preview',
        }
      });
      
      this.logSuccess("CDKTF synthesis completed");
    } catch (error) {
      throw new Error(`Failed to synthesize CDKTF configuration: ${error}`);
    }
  }

  private async initializeTerraform(): Promise<void> {
    this.logSection("Initializing Terraform");
    
    try {
      const cdktfOutDir = join(this.terraformDir, "cdktf.out", "stacks", "vargasjr-preview");
      
      execSync("terraform init", {
        stdio: 'inherit',
        cwd: cdktfOutDir
      });
      
      this.logSuccess("Terraform initialization completed");
    } catch (error) {
      throw new Error(`Failed to initialize terraform: ${error}`);
    }
  }

  private async checkResourceInState(): Promise<boolean> {
    this.logSection("Checking current terraform state");
    
    try {
      const cdktfOutDir = join(this.terraformDir, "cdktf.out", "stacks", "vargasjr-preview");
      
      execSync(`terraform state show ${this.SECURITY_GROUP_RESOURCE}`, {
        stdio: 'pipe',
        cwd: cdktfOutDir
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async importSecurityGroup(): Promise<void> {
    this.logSection("Importing existing AWS security group");
    
    try {
      const cdktfOutDir = join(this.terraformDir, "cdktf.out", "stacks", "vargasjr-preview");
      const importCommand = `terraform import ${this.SECURITY_GROUP_RESOURCE} ${this.SECURITY_GROUP_ID}`;
      
      this.logSuccess(`Importing ${this.SECURITY_GROUP_RESOURCE} -> ${this.SECURITY_GROUP_ID}`);
      
      execSync(importCommand, {
        stdio: 'inherit',
        cwd: cdktfOutDir
      });
      
      this.logSuccess("Successfully imported security group");
    } catch (error) {
      throw new Error(`Failed to import security group: ${error}`);
    }
  }

  private buildImportCommands(): string[] {
    const cdktfOutDir = "terraform/cdktf.out/stacks/vargasjr-preview";
    
    return [
      "# Navigate to terraform directory",
      "cd terraform",
      "",
      "# Generate CDKTF providers",
      "npx cdktf get",
      "",
      "# Synthesize CDKTF code", 
      "npx cdktf synth",
      "",
      "# Navigate to generated terraform directory",
      `cd ${cdktfOutDir}`,
      "",
      "# Initialize terraform",
      "terraform init",
      "",
      "# Import security group",
      `terraform import ${this.SECURITY_GROUP_RESOURCE} ${this.SECURITY_GROUP_ID}`
    ];
  }

  private async postSuccessComment(action: string): Promise<void> {
    const content = `# ✅ Security Group Import Migration Results\n\n` +
      `**Security Group**: \`vargas-jr-ssh-access\` (ID: \`${this.SECURITY_GROUP_ID}\`)\n` +
      `**Status**: Successfully ${action}\n\n` +
      `**Result**: The security group is now managed by Terraform state. ` +
      `This resolves the "InvalidGroup.Duplicate" error during terraform apply.\n\n` +
      `---\n*Migration completed at ${new Date().toLocaleString()}*`;
    
    await this.postComment(content);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const migration = new SecurityGroupImportMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
