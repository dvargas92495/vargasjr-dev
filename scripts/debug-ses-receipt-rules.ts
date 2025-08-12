#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { execSync } from "child_process";

class SESReceiptRuleDebugger extends OneTimeMigrationRunner {
  protected migrationName = "SES Receipt Rule Debugging";
  protected userAgent = "vargasjr-dev-ses-debug-script";

  protected async runMigration(): Promise<void> {
    this.logSection("SES Receipt Rule Debugging Analysis");
    
    await this.checkAWSAuthentication();
    await this.listReceiptRuleSets();
    await this.checkActiveReceiptRuleSet();
    await this.inspectSpecificRuleSet();
    await this.verifyLambdaPermissions();
    await this.checkRegionConsistency();
    await this.compareTerraformExpectedState();
    
    this.logSection("Debugging Summary");
    this.logSuccess("SES receipt rule debugging completed. Check output above for discrepancies.");
  }

  private async checkAWSAuthentication(): Promise<void> {
    this.logSection("AWS Authentication Check");
    
    try {
      const identity = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
      console.log("✅ AWS Authentication successful:");
      console.log(identity);
      
      const region = execSync('aws configure get region || echo "us-east-1"', { encoding: 'utf8' }).trim();
      console.log(`🌍 Current AWS region: ${region}`);
      
      if (region !== 'us-east-1') {
        this.logWarning(`Region is ${region}, but SES resources are expected in us-east-1`);
      }
    } catch (error) {
      this.logError(`AWS authentication failed: ${error}`);
      throw error;
    }
  }

  private async listReceiptRuleSets(): Promise<void> {
    this.logSection("Listing All SES Receipt Rule Sets");
    
    try {
      const ruleSets = execSync('aws ses list-receipt-rule-sets --region us-east-1', { encoding: 'utf8' });
      console.log("📋 All receipt rule sets in us-east-1:");
      console.log(ruleSets);
      
      const parsed = JSON.parse(ruleSets);
      if (!parsed.RuleSets || parsed.RuleSets.length === 0) {
        this.logWarning("No receipt rule sets found in us-east-1");
      } else {
        this.logSuccess(`Found ${parsed.RuleSets.length} receipt rule set(s)`);
        parsed.RuleSets.forEach((ruleSet: any, index: number) => {
          console.log(`  ${index + 1}. ${ruleSet.Name} (Created: ${ruleSet.CreatedTimestamp})`);
        });
      }
    } catch (error) {
      this.logError(`Failed to list receipt rule sets: ${error}`);
      throw error;
    }
  }

  private async checkActiveReceiptRuleSet(): Promise<void> {
    this.logSection("Checking Active Receipt Rule Set");
    
    try {
      const activeRuleSet = execSync('aws ses describe-active-receipt-rule-set --region us-east-1', { encoding: 'utf8' });
      console.log("🎯 Active receipt rule set:");
      console.log(activeRuleSet);
      
      const parsed = JSON.parse(activeRuleSet);
      if (!parsed.Metadata || !parsed.Metadata.Name) {
        this.logWarning("No active receipt rule set found");
      } else {
        this.logSuccess(`Active rule set: ${parsed.Metadata.Name}`);
        
        if (parsed.Metadata.Name !== 'vargas-jr-email-rules') {
          this.logWarning(`Expected 'vargas-jr-email-rules' but found '${parsed.Metadata.Name}'`);
        }
      }
    } catch (error) {
      this.logError(`Failed to check active receipt rule set: ${error}`);
      console.log("This might indicate no active rule set is configured");
    }
  }

  private async inspectSpecificRuleSet(): Promise<void> {
    this.logSection("Inspecting 'vargas-jr-email-rules' Rule Set");
    
    try {
      const ruleSetDetails = execSync('aws ses describe-receipt-rule-set --rule-set-name vargas-jr-email-rules --region us-east-1', { encoding: 'utf8' });
      console.log("📝 Rule set details:");
      console.log(ruleSetDetails);
      
      const parsed = JSON.parse(ruleSetDetails);
      if (!parsed.Rules || parsed.Rules.length === 0) {
        this.logWarning("No rules found in 'vargas-jr-email-rules' rule set");
      } else {
        this.logSuccess(`Found ${parsed.Rules.length} rule(s) in the rule set`);
        parsed.Rules.forEach((rule: any, index: number) => {
          console.log(`  ${index + 1}. ${rule.Name} (Enabled: ${rule.Enabled})`);
          console.log(`     Recipients: ${rule.Recipients?.join(', ') || 'None'}`);
          console.log(`     Actions: ${rule.Actions?.length || 0} action(s)`);
          
          if (rule.Actions) {
            rule.Actions.forEach((action: any, actionIndex: number) => {
              if (action.LambdaAction) {
                console.log(`       Lambda Action ${actionIndex + 1}: ${action.LambdaAction.FunctionArn}`);
              }
            });
          }
        });
      }
    } catch (error) {
      this.logError(`Failed to inspect rule set 'vargas-jr-email-rules': ${error}`);
      console.log("This might indicate the rule set doesn't exist");
    }
  }

  private async verifyLambdaPermissions(): Promise<void> {
    this.logSection("Verifying Lambda Function Permissions");
    
    try {
      const lambdaPolicy = execSync('aws lambda get-policy --function-name vargas-jr-email-processor --region us-east-1', { encoding: 'utf8' });
      console.log("🔐 Lambda function policy:");
      console.log(lambdaPolicy);
      
      const parsed = JSON.parse(lambdaPolicy);
      const policy = JSON.parse(parsed.Policy);
      
      const sesPermission = policy.Statement?.find((stmt: any) => 
        stmt.Principal?.Service === 'ses.amazonaws.com' && 
        stmt.Action === 'lambda:InvokeFunction'
      );
      
      if (sesPermission) {
        this.logSuccess("SES has permission to invoke the Lambda function");
      } else {
        this.logWarning("SES permission to invoke Lambda function not found");
      }
    } catch (error) {
      this.logError(`Failed to check Lambda permissions: ${error}`);
      console.log("This might indicate the Lambda function doesn't exist or has no policy");
    }
  }

  private async checkRegionConsistency(): Promise<void> {
    this.logSection("Checking Region Consistency");
    
    try {
      const lambdaFunctions = execSync('aws lambda list-functions --region us-east-1 --query "Functions[?FunctionName==\'vargas-jr-email-processor\']"', { encoding: 'utf8' });
      console.log("🌍 Lambda function in us-east-1:");
      console.log(lambdaFunctions);
      
      const parsed = JSON.parse(lambdaFunctions);
      if (!parsed || parsed.length === 0) {
        this.logWarning("Lambda function 'vargas-jr-email-processor' not found in us-east-1");
      } else {
        this.logSuccess("Lambda function found in us-east-1");
      }
      
      const sesIdentities = execSync('aws ses list-identities --region us-east-1', { encoding: 'utf8' });
      console.log("📧 SES identities in us-east-1:");
      console.log(sesIdentities);
      
      const identitiesParsed = JSON.parse(sesIdentities);
      const hasVargasJrDev = identitiesParsed.Identities?.includes('vargasjr.dev') || 
                             identitiesParsed.Identities?.includes('hello@vargasjr.dev');
      
      if (hasVargasJrDev) {
        this.logSuccess("VargasJR domain/email identities found in us-east-1");
      } else {
        this.logWarning("VargasJR domain/email identities not found in us-east-1");
      }
    } catch (error) {
      this.logError(`Failed to check region consistency: ${error}`);
    }
  }

  private async compareTerraformExpectedState(): Promise<void> {
    this.logSection("Terraform Expected State vs Actual AWS State");
    
    console.log("📋 Expected Terraform Configuration:");
    console.log("  - Rule Set Name: 'vargas-jr-email-rules'");
    console.log("  - Rule Name: 'process-incoming-email'");
    console.log("  - Recipients: ['hello@vargasjr.dev']");
    console.log("  - Lambda Function: 'vargas-jr-email-processor'");
    console.log("  - Rule Set should be ACTIVE");
    console.log("  - Region: us-east-1");
    
    console.log("\n🔍 Key Areas to Investigate:");
    console.log("  1. Is the rule set created but not active?");
    console.log("  2. Are the rules created but not enabled?");
    console.log("  3. Are there permission issues preventing SES from invoking Lambda?");
    console.log("  4. Is there a region mismatch?");
    console.log("  5. Are there AWS console caching issues?");
    
    console.log("\n💡 Potential Solutions:");
    console.log("  - If rule set exists but not active: Check SesActiveReceiptRuleSet resource");
    console.log("  - If Lambda permissions missing: Check LambdaPermission resource");
    console.log("  - If rules not visible: Try refreshing AWS console or check different region");
    console.log("  - If Terraform state drift: Run 'terraform plan' to see differences");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const sesDebugger = new SESReceiptRuleDebugger(isPreviewMode);
  await sesDebugger.run();
}

if (require.main === module) {
  main().catch(console.error);
}
