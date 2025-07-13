import { execSync } from "child_process";
import { OneTimeMigrationRunner } from "./utils";

export class SecurityGroupRulesImportMigration extends OneTimeMigrationRunner {
  protected migrationName = "Security Group Rules Import Migration";
  protected userAgent = "SecurityGroupRulesImportMigration/1.0";

  async runMigration(): Promise<void> {
    this.logSection("Starting Security Group Rules Import Migration");
    this.logSection("Executing terraform import commands");

    this.logSection("Generating CDKTF providers");
    if (!this.isPreviewMode) {
      execSync("npx cdktf get", { 
        cwd: "./terraform", 
        stdio: "inherit" 
      });
    } else {
      console.log("Preview: npx cdktf get");
    }

    this.logSection("Synthesizing CDKTF code");
    if (!this.isPreviewMode) {
      execSync("npx cdktf synth", { 
        cwd: "./terraform", 
        stdio: "inherit" 
      });
      this.logSuccess("CDKTF synthesis completed");
    } else {
      console.log("Preview: npx cdktf synth");
    }

    this.logSection("Initializing Terraform");
    if (!this.isPreviewMode) {
      execSync("terraform init", { 
        cwd: "./terraform/cdktf.out/stacks/vargasjr-preview", 
        stdio: "inherit" 
      });
      this.logSuccess("Terraform initialization completed");
    } else {
      console.log("Preview: terraform init");
    }

    this.logSection("Checking current terraform state");
    if (!this.isPreviewMode) {
      try {
        const stateOutput = execSync("terraform state list", { 
          cwd: "./terraform/cdktf.out/stacks/vargasjr-preview",
          encoding: "utf8"
        });
        
        const hasIngressRule = stateOutput.includes("aws_security_group_rule.SSHIngressRule");
        const hasEgressRule = stateOutput.includes("aws_security_group_rule.AllEgressRule");
        
        if (hasIngressRule && hasEgressRule) {
          this.logWarning("Both security group rules already exist in terraform state, skipping import");
          return;
        }
        
        if (hasIngressRule) {
          this.logWarning("Ingress rule already exists in terraform state, skipping ingress import");
        }
        
        if (hasEgressRule) {
          this.logWarning("Egress rule already exists in terraform state, skipping egress import");
        }
      } catch (error) {
        console.log("No existing state found, proceeding with import");
      }
    } else {
      console.log("Preview: terraform state list");
    }

    this.logSection("Importing existing AWS security group rules");
    
    if (!this.isPreviewMode) {
      try {
        const ingressStateOutput = execSync("terraform state list", { 
          cwd: "./terraform/cdktf.out/stacks/vargasjr-preview",
          encoding: "utf8"
        });
        
        if (!ingressStateOutput.includes("aws_security_group_rule.SSHIngressRule")) {
          this.logSuccess("Importing aws_security_group_rule.SSHIngressRule -> sgr-0c8ee58d1f115d62c");
          execSync("terraform import aws_security_group_rule.SSHIngressRule sgr-0c8ee58d1f115d62c", { 
            cwd: "./terraform/cdktf.out/stacks/vargasjr-preview", 
            stdio: "inherit" 
          });
        }
      } catch (error) {
        console.log("Proceeding with ingress rule import");
        this.logSuccess("Importing aws_security_group_rule.SSHIngressRule -> sgr-0c8ee58d1f115d62c");
        execSync("terraform import aws_security_group_rule.SSHIngressRule sgr-0c8ee58d1f115d62c", { 
          cwd: "./terraform/cdktf.out/stacks/vargasjr-preview", 
          stdio: "inherit" 
        });
      }
    } else {
      console.log("Preview: terraform import aws_security_group_rule.SSHIngressRule sgr-0c8ee58d1f115d62c");
    }

    if (!this.isPreviewMode) {
      try {
        const egressStateOutput = execSync("terraform state list", { 
          cwd: "./terraform/cdktf.out/stacks/vargasjr-preview",
          encoding: "utf8"
        });
        
        if (!egressStateOutput.includes("aws_security_group_rule.AllEgressRule")) {
          this.logSuccess("Importing aws_security_group_rule.AllEgressRule -> sgr-0644d2da06bd5ff67");
          execSync("terraform import aws_security_group_rule.AllEgressRule sgr-0644d2da06bd5ff67", { 
            cwd: "./terraform/cdktf.out/stacks/vargasjr-preview", 
            stdio: "inherit" 
          });
        }
      } catch (error) {
        console.log("Proceeding with egress rule import");
        this.logSuccess("Importing aws_security_group_rule.AllEgressRule -> sgr-0644d2da06bd5ff67");
        execSync("terraform import aws_security_group_rule.AllEgressRule sgr-0644d2da06bd5ff67", { 
          cwd: "./terraform/cdktf.out/stacks/vargasjr-preview", 
          stdio: "inherit" 
        });
      }
    } else {
      console.log("Preview: terraform import aws_security_group_rule.AllEgressRule sgr-0644d2da06bd5ff67");
    }

    this.logSuccess("Security group rules import completed successfully");
  }
}

if (require.main === module) {
  const isPreviewMode = process.argv.includes("--preview");
  const migration = new SecurityGroupRulesImportMigration(isPreviewMode);
  migration.run();
}
