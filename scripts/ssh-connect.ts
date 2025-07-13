#!/usr/bin/env npx tsx

import { EC2, Instance } from "@aws-sdk/client-ec2";
import { getSecret } from "./utils";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { execSync } from "child_process";

interface SSHConnectConfig {
  prNumber?: string;
  region?: string;
  command?: string;
}

class VargasJRSSHConnector {
  private ec2: EC2;
  private config: SSHConnectConfig;

  constructor(config: SSHConnectConfig) {
    this.config = {
      region: "us-east-1",
      ...config
    };
    this.ec2 = new EC2({ region: this.config.region });
  }

  async connect(): Promise<void> {
    try {
      const instance = await this.findInstance();
      if (!instance) {
        throw new Error("No instance found");
      }

      const keyMaterial = await this.getSSHKey();
      const keyPath = await this.writeKeyToTempFile(keyMaterial);

      try {
        await this.establishSSHConnection(instance.PublicDnsName || "", keyPath, this.config.command);
      } finally {
        unlinkSync(keyPath);
      }
    } catch (error) {
      console.error(`❌ Failed to establish SSH connection: ${error}`);
      process.exit(1);
    }
  }

  private async findInstance(): Promise<Instance> {
    let filters;
    
    if (this.config.prNumber) {
      console.log(`Looking for PR ${this.config.prNumber} instance...`);
      filters = [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:PRNumber", Values: [this.config.prNumber] },
        { Name: "instance-state-name", Values: ["running"] }
      ];
    } else {
      console.log("Looking for production instance...");
      filters = [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:Type", Values: ["main"] },
        { Name: "instance-state-name", Values: ["running"] }
      ];
    }

    const result = await this.ec2.describeInstances({ Filters: filters });
    const instances = result.Reservations?.flatMap((r) => r.Instances || []) || [];
    
    if (instances.length === 0) {
      const instanceType = this.config.prNumber ? `PR ${this.config.prNumber}` : "production";
      throw new Error(`No running ${instanceType} instance found`);
    }

    if (instances.length > 1) {
      const instanceType = this.config.prNumber ? `PR ${this.config.prNumber}` : "production";
      console.warn(`⚠️  Multiple ${instanceType} instances found, using the first one`);
    }

    const instance = instances[0];
    console.log(`✅ Found instance: ${instance.InstanceId}`);
    console.log(`   Public DNS: ${instance.PublicDnsName}`);
    
    if (!instance.PublicDnsName) {
      throw new Error("Instance does not have a public DNS name");
    }
    
    return instance;
  }

  private async getSSHKey(): Promise<string> {
    let secretName;
    
    if (this.config.prNumber) {
      secretName = `vargasjr-pr-${this.config.prNumber}-key-pem`;
    } else {
      secretName = `vargasjr-prod-prod-key-pem`;
    }

    console.log(`Retrieving SSH key from secret: ${secretName}`);
    return await getSecret(secretName, this.config.region);
  }

  private async writeKeyToTempFile(keyMaterial: string): Promise<string> {
    const keyPath = `${tmpdir()}/vargasjr-ssh-${Date.now()}.pem`;
    writeFileSync(keyPath, keyMaterial, { mode: 0o600 });
    console.log(`✅ SSH key written to temporary file: ${keyPath}`);
    return keyPath;
  }

  private async establishSSHConnection(publicDns: string, keyPath: string, command?: string): Promise<void> {
    if (!publicDns) {
      throw new Error("No public DNS name available for SSH connection");
    }
    
    console.log(`🔗 Connecting to ubuntu@${publicDns}...`);
    
    let sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@${publicDns}`;
    
    if (command) {
      sshCommand += ` "${command}"`;
      try {
        execSync(sshCommand, { stdio: 'inherit' });
      } catch (error: any) {
        console.error(`❌ Command execution failed: ${error.message}`);
        process.exit(error.status || 1);
      }
    } else {
      try {
        execSync(sshCommand, { stdio: 'inherit' });
      } catch (error: any) {
        if (error.status === 130) {
          console.log("\n👋 SSH session ended");
        } else {
          throw new Error(`SSH connection failed: ${error.message}`);
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  let prNumber: string | undefined;
  let command: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pr" && i + 1 < args.length) {
      prNumber = args[i + 1];
      i++;
    } else if (args[i] === "--command" && i + 1 < args.length) {
      command = args[i + 1];
      i++;
    } else if (args[i] && !args[i].startsWith("--")) {
      prNumber = args[i];
    }
  }
  
  if (prNumber && !/^\d+$/.test(prNumber)) {
    console.error("PR number must be a valid number");
    process.exit(1);
  }

  const connector = new VargasJRSSHConnector({ prNumber, command });
  await connector.connect();
}

if (require.main === module) {
  main().catch(console.error);
}
