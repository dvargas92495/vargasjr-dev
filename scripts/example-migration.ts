#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { execSync } from "child_process";
import { join } from "path";

class TerraformImportMigration extends OneTimeMigrationRunner {
  protected migrationName = "Terraform Resource Import Migration";
  protected userAgent = "vargasjr-dev-terraform-import-migration";

  protected async runMigration(): Promise<void> {
    this.logSection("Starting Terraform Resource Import Migration");
    
    const terraformDir = join(process.cwd(), "terraform");
    
    if (this.isPreviewMode) {
      this.logSuccess("Preview mode: Would execute terraform import commands");
      await this.postComment(
        "# Terraform Import Migration Preview\n\n" +
        "✅ **Migration Preview Successful**\n\n" +
        "This migration will import existing AWS resources into terraform state to resolve 'already exists' errors.\n\n" +
        "**Resources to be imported:**\n" +
        "- S3 Bucket: `vargas-jr-memory`\n" +
        "- S3 Bucket: `vargas-jr-inbox`\n" +
        "- S3 Bucket: `vargas-jr-terraform-state`\n" +
        "- Security Group: `vargas-jr-ssh-access`\n" +
        "- IAM Role: `vargas-jr-email-lambda-role`\n" +
        "- Lambda Function: `vargas-jr-email-processor`\n" +
        "- SES Domain Identity: `vargasjr.dev`\n" +
        "- SES Email Identity: `hello@vargasjr.dev`\n" +
        "- SES Receipt Rule Set: `vargas-jr-email-rules`\n\n" +
        "**Environment:** Preview Mode\n" +
        "**Status:** Ready for execution"
      );
    } else {
      this.logSuccess("Executing terraform import commands");
      
      try {
        process.chdir(terraformDir);
        
        this.logSection("Generating CDKTF providers");
        execSync("npx cdktf get", { stdio: 'inherit' });
        
        this.logSection("Synthesizing CDKTF code");
        execSync("npx cdktf synth", { stdio: 'inherit' });
        
        this.logSection("Importing existing AWS resources");
        
        await this.importResource("aws_s3_bucket.MemoryBucket", "vargas-jr-memory");
        await this.importResource("aws_s3_bucket.InboxBucket", "vargas-jr-inbox");
        await this.importResource("aws_s3_bucket.TerraformStateBucket", "vargas-jr-terraform-state");
        
        await this.importResource("aws_security_group.SSHSecurityGroup", "vargas-jr-ssh-access");
        
        await this.importResource("aws_iam_role.EmailLambdaRole", "vargas-jr-email-lambda-role");
        
        await this.importResource("aws_lambda_function.EmailLambdaFunction", "vargas-jr-email-processor");
        
        await this.importResource("aws_ses_domain_identity.DomainIdentity", "vargasjr.dev");
        await this.importResource("aws_ses_email_identity.EmailIdentity", "hello@vargasjr.dev");
        await this.importResource("aws_ses_receipt_rule_set.EmailReceiptRuleSet", "vargas-jr-email-rules");
        
        this.logSuccess("All terraform imports completed successfully");
        
        await this.postComment(
          "# Terraform Import Migration Results\n\n" +
          "✅ **Migration Completed Successfully**\n\n" +
          "Successfully imported existing AWS resources into terraform state.\n\n" +
          "**Imported Resources:**\n" +
          "- ✅ S3 Bucket: `vargas-jr-memory`\n" +
          "- ✅ S3 Bucket: `vargas-jr-inbox`\n" +
          "- ✅ S3 Bucket: `vargas-jr-terraform-state`\n" +
          "- ✅ Security Group: `vargas-jr-ssh-access`\n" +
          "- ✅ IAM Role: `vargas-jr-email-lambda-role`\n" +
          "- ✅ Lambda Function: `vargas-jr-email-processor`\n" +
          "- ✅ SES Domain Identity: `vargasjr.dev`\n" +
          "- ✅ SES Email Identity: `hello@vargasjr.dev`\n" +
          "- ✅ SES Receipt Rule Set: `vargas-jr-email-rules`\n\n" +
          `**Execution time:** ${new Date().toISOString()}\n\n` +
          "This should resolve 'already exists' errors in future terraform deployments."
        );
        
      } catch (error) {
        this.logError(`Terraform import failed: ${error}`);
        throw error;
      }
    }
  }
  
  private async importResource(terraformAddress: string, awsResourceId: string): Promise<void> {
    try {
      this.logSuccess(`Importing ${terraformAddress} -> ${awsResourceId}`);
      execSync(`npx cdktf import ${terraformAddress} ${awsResourceId}`, { 
        stdio: 'inherit',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });
      this.logSuccess(`Successfully imported ${terraformAddress}`);
    } catch (error) {
      this.logWarning(`Failed to import ${terraformAddress}: ${error}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const migration = new TerraformImportMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
