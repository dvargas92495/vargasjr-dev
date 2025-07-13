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
        "- S3 Bucket: `vargas-jr-memory` → `aws_s3_bucket.MemoryBucket`\n" +
        "- S3 Bucket: `vargas-jr-inbox` → `aws_s3_bucket.InboxBucket`\n" +
        "- Security Group: `vargas-jr-ssh-access` → `aws_security_group.SSHSecurityGroup`\n" +
        "- IAM Role: `vargas-jr-email-lambda-role` → `aws_iam_role.EmailLambdaRole`\n" +
        "- Lambda Function: `vargas-jr-email-processor` → `aws_lambda_function.EmailLambdaFunction`\n" +
        "- SES Domain Identity: `vargasjr.dev` → `aws_ses_domain_identity.DomainIdentity`\n" +
        "- SES Email Identity: `hello@vargasjr.dev` → `aws_ses_email_identity.EmailIdentity`\n" +
        "- SES Receipt Rule Set: `vargas-jr-email-rules` → `aws_ses_receipt_rule_set.EmailReceiptRuleSet`\n\n" +
        "**Note:** S3 terraform state bucket is managed by backend configuration and doesn't need explicit import.\n\n" +
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
        
        const stackDir = join(terraformDir, "cdktf.out/stacks/vargasjr-preview");
        process.chdir(stackDir);
        
        this.logSection("Initializing Terraform");
        execSync("terraform init", { stdio: 'inherit' });
        
        this.logSection("Importing existing AWS resources");
        
        const importResults: Array<{resource: string, id: string, success: boolean, error?: string}> = [];
        
        await this.importResource("aws_s3_bucket.MemoryBucket", "vargas-jr-memory", importResults);
        await this.importResource("aws_s3_bucket.InboxBucket", "vargas-jr-inbox", importResults);
        await this.importResource("aws_security_group.SSHSecurityGroup", "vargas-jr-ssh-access", importResults);
        await this.importResource("aws_iam_role.EmailLambdaRole", "vargas-jr-email-lambda-role", importResults);
        await this.importResource("aws_lambda_function.EmailLambdaFunction", "vargas-jr-email-processor", importResults);
        await this.importResource("aws_ses_domain_identity.DomainIdentity", "vargasjr.dev", importResults);
        await this.importResource("aws_ses_email_identity.EmailIdentity", "hello@vargasjr.dev", importResults);
        await this.importResource("aws_ses_receipt_rule_set.EmailReceiptRuleSet", "vargas-jr-email-rules", importResults);
        
        const successCount = importResults.filter(r => r.success).length;
        const failureCount = importResults.filter(r => !r.success).length;
        
        if (successCount > 0) {
          this.logSuccess(`Successfully imported ${successCount} resources`);
        }
        if (failureCount > 0) {
          this.logWarning(`Failed to import ${failureCount} resources`);
        }
        
        await this.postImportResults(importResults);
        
      } catch (error) {
        this.logError(`Terraform import migration failed: ${error}`);
        await this.postComment(
          "# Terraform Import Migration Failed\n\n" +
          "❌ **Migration Failed**\n\n" +
          "The terraform import migration encountered critical errors.\n\n" +
          "**Error Details:**\n" +
          "```\n" +
          `${error}\n` +
          "```\n\n" +
          "**Common Causes:**\n" +
          "- Missing AWS credentials in the execution environment\n" +
          "- Terraform CLI not installed or not accessible\n" +
          "- S3 backend configuration issues\n" +
          "- Network connectivity issues\n\n" +
          "**Next Steps:**\n" +
          "1. Verify AWS credentials are properly configured\n" +
          "2. Ensure Terraform CLI is installed and accessible\n" +
          "3. Check S3 backend bucket accessibility\n" +
          "4. Review terraform configuration for syntax errors\n\n" +
          `**Execution time:** ${new Date().toISOString()}`
        );
        throw error;
      }
    }
  }
  
  private async importResource(
    terraformAddress: string, 
    awsResourceId: string, 
    results: Array<{resource: string, id: string, success: boolean, error?: string}>
  ): Promise<void> {
    try {
      this.logSuccess(`Importing ${terraformAddress} -> ${awsResourceId}`);
      execSync(`terraform import ${terraformAddress} ${awsResourceId}`, { 
        stdio: 'pipe',
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        },
        maxBuffer: 1024 * 1024 * 10
      });
      this.logSuccess(`Successfully imported ${terraformAddress}`);
      results.push({resource: terraformAddress, id: awsResourceId, success: true});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stderr = (error as any).stderr || '';
      const stdout = (error as any).stdout || '';
      const fullError = `${errorMessage}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`.trim();
      this.logWarning(`Failed to import ${terraformAddress}: ${fullError}`);
      results.push({resource: terraformAddress, id: awsResourceId, success: false, error: fullError});
    }
  }
  
  private async postImportResults(results: Array<{resource: string, id: string, success: boolean, error?: string}>): Promise<void> {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    let comment = "# Terraform Import Migration Results\n\n";
    
    if (successCount === results.length) {
      comment += "✅ **Migration Completed Successfully**\n\n";
      comment += "Successfully imported all existing AWS resources into terraform state.\n\n";
    } else if (successCount > 0) {
      comment += "⚠️ **Migration Partially Completed**\n\n";
      comment += `Successfully imported ${successCount} out of ${results.length} resources.\n\n`;
    } else {
      comment += "❌ **Migration Failed**\n\n";
      comment += "Failed to import any resources. See detailed errors below.\n\n";
    }
    
    comment += "## Import Results\n\n";
    
    for (const result of results) {
      if (result.success) {
        comment += `- ✅ **${result.resource}** ← \`${result.id}\`\n`;
      } else {
        comment += `- ❌ **${result.resource}** ← \`${result.id}\`\n`;
        if (result.error) {
          comment += `  - Error: \`${result.error.split('\n')[0]}\`\n`;
        }
      }
    }
    
    if (failureCount > 0) {
      comment += "\n## Detailed Error Information\n\n";
      const failedResults = results.filter(r => !r.success);
      
      for (const result of failedResults) {
        comment += `### ${result.resource}\n`;
        comment += `**Resource ID:** \`${result.id}\`\n\n`;
        if (result.error) {
          comment += "**Error Details:**\n";
          comment += "```\n";
          comment += result.error;
          comment += "\n```\n\n";
        }
      }
      
      comment += "## Common Solutions\n\n";
      comment += "**For 'NoCredentialProviders' or 'no valid credential sources' errors:**\n";
      comment += "- Ensure AWS credentials are configured in the execution environment\n";
      comment += "- Check that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set\n";
      comment += "- Verify the AWS credentials have sufficient permissions for the resources\n\n";
      comment += "**For 'Backend initialization required' errors:**\n";
      comment += "- The terraform backend needs to be initialized before imports\n";
      comment += "- This should be handled automatically by the script's terraform init step\n\n";
      comment += "**For 'resource does not exist' errors:**\n";
      comment += "- Verify the AWS resource actually exists in the target account\n";
      comment += "- Check the resource ID/name matches exactly (case-sensitive)\n";
      comment += "- Ensure you're targeting the correct AWS region (us-east-1)\n\n";
      comment += "**For 'already managed by Terraform' errors:**\n";
      comment += "- The resource is already in terraform state (this is actually good!)\n";
      comment += "- No action needed for these resources\n\n";
    }
    
    comment += `\n**Execution time:** ${new Date().toISOString()}\n`;
    
    if (successCount > 0) {
      comment += "\nThis should help resolve 'already exists' errors in future terraform deployments.";
    }
    
    await this.postComment(comment);
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
