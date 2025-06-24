#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { findInstancesByFilters, terminateInstances, waitForInstancesTerminated, findOrCreateSecurityGroup, createSecret, getNeonPreviewDatabaseUrl, checkInstanceHealth, findOrCreateSSMInstanceProfile } from "./utils";

interface AgentConfig {
  name: string;
  instanceType?: string;
  region?: string;
  prNumber?: string;
}

class VargasJRAgentCreator {
  private ec2: EC2;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = {
      instanceType: "t3.micro",
      region: "us-east-1",
      ...config
    };
    this.ec2 = new EC2({ region: this.config.region });
  }

  async createAgent(): Promise<void> {
    const agentName = this.config.prNumber ? `pr-${this.config.prNumber}` : this.config.name;
    const instanceName = `vargas-jr-${agentName}`;
    console.log(`Creating Vargas JR agent: ${agentName}`);

    try {
      await this.deleteExistingInstances(instanceName);

      const keyPairName = `${agentName}-key`;
      await this.createKeyPair(keyPairName);

      console.log("Waiting for key pair to propagate in AWS...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      const instanceId = await this.createEC2Instance(keyPairName);

      await this.waitForInstanceRunning(instanceId);

      const instanceDetails = await this.getInstanceDetails(instanceId);

      await this.setupInstance(instanceDetails, keyPairName);

      try {
        await this.waitForInstanceHealthy(instanceId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`⚠️  Health check failed: ${errorMessage}`);
        console.log("Continuing with agent setup despite health check failure...");
      }

      console.log(`✅ Agent ${agentName} infrastructure and SSH setup completed successfully!`);
      console.log(`Instance ID: ${instanceId}`);
      console.log(`Public DNS: ${instanceDetails.publicDns}`);

    } catch (error) {
      console.error(`❌ Failed to create agent: ${error}`);
      process.exit(1);
    }
  }

  private async deleteExistingInstances(instanceName: string): Promise<void> {
    const existingInstances = await findInstancesByFilters(this.ec2, [
      { Name: "tag:Name", Values: [instanceName] },
      { Name: "tag:Project", Values: ["VargasJR"] },
      { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
    ]);

    if (existingInstances.length === 0) {
      console.log(`No existing instances found with name: ${instanceName}`);
      return;
    }

    console.log(`Found ${existingInstances.length} existing instance(s) with name: ${instanceName}`);

    const instanceIds = existingInstances
      .map((instance: any) => instance.InstanceId)
      .filter((id: any): id is string => !!id);

    if (instanceIds.length > 0) {
      console.log(`Terminating instances: ${instanceIds.join(", ")}`);
      await terminateInstances(this.ec2, instanceIds);
      console.log(`✅ Instances terminated: ${instanceIds.join(", ")}`);

      await waitForInstancesTerminated(this.ec2, instanceIds);
    }
  }

  private async createKeyPair(keyPairName: string): Promise<void> {
    console.log(`Creating key pair: ${keyPairName}`);

    try {
      const result = await this.ec2.createKeyPair({
        KeyName: keyPairName,
        KeyType: "rsa",
        KeyFormat: "pem"
      });

      if (result.KeyMaterial) {
        const keyPath = `${tmpdir()}/${keyPairName}.pem`;

        writeFileSync(keyPath, result.KeyMaterial, { mode: 0o600 });
        console.log(`✅ Key pair saved to ${keyPath}`);

        const env = this.config.prNumber ? `pr-${this.config.prNumber}` : "prod";
        const secretName = `vargasjr-${env}-${keyPairName}-pem`;
        await createSecret(secretName, result.KeyMaterial, this.config.region);
      }
    } catch (error: any) {
      if (error.name === "InvalidKeyPair.Duplicate") {
        console.log(`⚠️  Key pair ${keyPairName} already exists, skipping creation`);

        console.log(`Deleting existing key pair to recreate with new material...`);
        try {
          await this.ec2.deleteKeyPair({ KeyName: keyPairName });
          console.log(`✅ Deleted existing key pair: ${keyPairName}`);

          const newResult = await this.ec2.createKeyPair({
            KeyName: keyPairName,
            KeyType: "rsa",
            KeyFormat: "pem"
          });

          if (newResult.KeyMaterial) {
            const keyPath = `${tmpdir()}/${keyPairName}.pem`;

            writeFileSync(keyPath, newResult.KeyMaterial, { mode: 0o600 });
            console.log(`✅ Key pair recreated and saved to ${keyPath}`);

            const env = this.config.prNumber ? `pr-${this.config.prNumber}` : "prod";
            const secretName = `vargasjr-${env}-${keyPairName}-pem`;
            await createSecret(secretName, newResult.KeyMaterial, this.config.region);
          }
        } catch (deleteError) {
          console.error(`Failed to delete/recreate key pair: ${deleteError}`);
          throw deleteError;
        }
      } else {
        throw error;
      }
    }
  }

  private async createEC2Instance(keyPairName: string): Promise<string> {
    console.log("Creating EC2 instance...");

    const securityGroupId = await findOrCreateSecurityGroup(
      this.ec2,
      "vargas-jr-ssh-access",
      "Security group for VargasJR agent SSH access"
    );

    let iamInstanceProfile: string | undefined;
    try {
      iamInstanceProfile = await findOrCreateSSMInstanceProfile();
    } catch (error) {
      console.warn('Using Default Host Management Configuration approach');
    }

    const result = await this.ec2.runInstances({
      ImageId: "ami-0e2c8caa4b6378d8c",
      InstanceType: this.config.instanceType as any,
      KeyName: keyPairName,
      SecurityGroupIds: [securityGroupId],
      ...(iamInstanceProfile && {
        IamInstanceProfile: {
          Name: iamInstanceProfile
        }
      }),
      MetadataOptions: {
        HttpTokens: "required",
        HttpPutResponseHopLimit: 1,
        HttpEndpoint: "enabled"
      },
      MinCount: 1,
      MaxCount: 1,
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            { Key: "Name", Value: this.config.prNumber ? `vargas-jr-pr-${this.config.prNumber}` : `vargas-jr-${this.config.name}` },
            { Key: "Project", Value: "VargasJR" },
            { Key: "CreatedBy", Value: "create-agent-script" },
            { Key: "PRNumber", Value: this.config.prNumber || "" },
            { Key: "Type", Value: this.config.prNumber ? "preview" : "main" }
          ]
        }
      ]
    });

    const instanceId = result.Instances?.[0]?.InstanceId;
    if (!instanceId) {
      throw new Error("Failed to get instance ID");
    }

    console.log(`✅ EC2 instance created: ${instanceId}`);
    return instanceId;
  }

  private async waitForInstanceRunning(instanceId: string): Promise<void> {
    console.log("Waiting for instance to be running...");

    console.log("Waiting for instance to be available in AWS API...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    let attempts = 0;
    const maxAttempts = 40;

    while (attempts < maxAttempts) {
      try {
        const result = await this.ec2.describeInstances({
          InstanceIds: [instanceId]
        });

        const instance = result.Reservations?.[0]?.Instances?.[0];
        if (instance?.State?.Name === "running") {
          console.log("✅ Instance is running");
          return;
        }

        attempts++;
        console.log(`Instance state: ${instance?.State?.Name}, waiting... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (error: any) {
        if (error.name === "InvalidInstanceID.NotFound" && attempts < 5) {
          console.log(`Instance not yet available in API, retrying... (${attempts + 1}/5)`);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        throw error;
      }
    }

    throw new Error("Instance failed to reach running state within timeout");
  }

  private async getInstanceDetails(instanceId: string) {
    const result = await this.ec2.describeInstances({
      InstanceIds: [instanceId]
    });

    const instance = result.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      throw new Error("Failed to get instance details");
    }

    return {
      instanceId,
      publicDns: instance.PublicDnsName || "",
      publicIp: instance.PublicIpAddress || ""
    };
  }

  private async setupInstance(instanceDetails: any, keyPairName: string): Promise<void> {
    console.log(`Basic setup for Vargas JR agent instance: ${instanceDetails.instanceId}`);
    console.log(`Instance available at: ${instanceDetails.publicDns}`);
    console.log(`SSH key available at: ${tmpdir()}/${keyPairName}.pem`);


    await this.waitForSSHReady(instanceDetails.publicDns, keyPairName);

    const envVars = this.getEnvironmentVariables();

    try {
      const dbName = this.config.name.replace('-', '_');

      let postgresUrl: string;
      if (this.config.prNumber) {
        postgresUrl = await getNeonPreviewDatabaseUrl();
      } else {
        postgresUrl = `postgresql://postgres:password@localhost:5432/vargasjr_${dbName}`;
      }

      let envContent = `POSTGRES_URL=${postgresUrl}
LOG_LEVEL=INFO
VELLUM_API_KEY=${envVars.VELLUM_API_KEY}
AWS_ACCESS_KEY_ID=${envVars.AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${envVars.AWS_SECRET_ACCESS_KEY}
AWS_DEFAULT_REGION=us-east-1`;

      if (this.config.prNumber) {
        envContent += `
AGENT_ENVIRONMENT=preview
PR_NUMBER=${this.config.prNumber}
GITHUB_TOKEN=${envVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''}`;
      }

      writeFileSync('/tmp/agent.env', envContent);
      const setupCommands = [
        { tag: 'APT', command: 'sudo apt update' },
        { tag: 'PYTHON', command: 'sudo apt install -y python3.12 python3.12-venv python3-pip' },
        { tag: 'PY3_12', command: 'sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1' },
        { tag: 'PY_ALIAS', command: 'sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1' },
        { tag: 'SSM_STATUS', command: 'sudo systemctl is-active snap.amazon-ssm-agent.amazon-ssm-agent.service || sudo snap start amazon-ssm-agent' },
        { tag: 'POETRY', command: 'curl -sSL https://install.python-poetry.org | python - -y --version 1.8.3' },
        { tag: 'PROFILE', command: 'source ~/.profile' }
      ];

      const keyPath = `${tmpdir()}/${keyPairName}.pem`;

      for (const commandObj of setupCommands) {
        await this.executeSSHCommand(keyPath, instanceDetails.publicDns, commandObj);
      }

      console.log("Copying .env file to instance...");
      await this.executeSCPCommand(keyPath, instanceDetails.publicDns, '/tmp/agent.env', '~/.env');

      console.log("Copying run_agent.sh script to instance...");
      await this.executeSCPCommand(keyPath, instanceDetails.publicDns, './run_agent.sh', '~/run_agent.sh');

      console.log("Making run_agent.sh executable and running it...");
      await this.executeSSHCommand(keyPath, instanceDetails.publicDns, { tag: 'CHMOD', command: 'chmod +x ~/run_agent.sh' });
      await this.executeSSHCommand(keyPath, instanceDetails.publicDns, { tag: 'AGENT', command: 'cd ~ && ./run_agent.sh' });

      console.log("✅ Instance setup complete!");

      console.log("Waiting for SSM agent to register with Systems Manager...");
      console.log("Note: Using snap-installed SSM agent service name for Ubuntu 24.04");
      console.log("Note: MetadataOptions enforce IMDSv2 which is required for SSM registration");
      console.log("Using IAM instance profile for reliable SSM registration");
      await new Promise(resolve => setTimeout(resolve, 30000));

    } catch (error) {
      console.error(`❌ Failed to setup instance: ${error}`);
      throw error;
    }
  }

  private async waitForSSHReady(publicDns: string, keyPairName: string): Promise<void> {
    const keyPath = `${tmpdir()}/${keyPairName}.pem`;
    const maxAttempts = 40;
    let attempts = 0;

    const sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes -o UserKnownHostsFile=/dev/null ubuntu@${publicDns} "exit 0"`;
    console.log(`Attempting SSH connection with command: ${sshCommand}`);

    while (attempts < maxAttempts) {
      try {
        execSync(sshCommand, {
          stdio: 'pipe'
        });
        console.log("✅ SSH is ready");
        return;
      } catch (error) {
        attempts++;
        const waitTime = attempts < 10 ? 10 : 15;
        console.log(`SSH not ready yet, attempt ${attempts}/${maxAttempts}. Waiting ${waitTime} seconds...`);
        console.log(`SSH error: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }

    throw new Error("SSH failed to become ready within timeout (10 minutes). Consider updating to Amazon Linux 2023 AMI for faster boot times.");
  }

  private async executeSSHCommand(keyPath: string, publicDns: string, commandObj: { tag: string; command: string }): Promise<void> {
    console.log(`Executing [${commandObj.tag}]: ${commandObj.command}`);

    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        execSync(`ssh -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=60 -o UserKnownHostsFile=/dev/null ubuntu@${publicDns} "${commandObj.command}"`, {
          stdio: 'inherit'
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`❌ [${commandObj.tag}] SSH command failed after ${maxAttempts} attempts: ${commandObj.command}`);
          throw error;
        }
        console.log(`[${commandObj.tag}] SSH command failed, retrying... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async executeSCPCommand(keyPath: string, publicDns: string, localPath: string, remotePath: string): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        execSync(`scp -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o UserKnownHostsFile=/dev/null ${localPath} ubuntu@${publicDns}:${remotePath}`, {
          stdio: 'inherit'
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`❌ SCP command failed after ${maxAttempts} attempts: ${localPath} -> ${remotePath}`);
          throw error;
        }
        console.log(`SCP command failed, retrying... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async waitForInstanceHealthy(instanceId: string): Promise<void> {
    console.log("Waiting for agent to be healthy...");

    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const healthResult = await checkInstanceHealth(instanceId, this.config.region);

        if (healthResult.status === "healthy") {
          console.log("✅ Agent is healthy and running");
          return;
        }

        attempts++;
        const waitTime = 1;
        console.log(`Agent not healthy yet (${healthResult.status}${healthResult.error ? `: ${healthResult.error}` : ''}), waiting... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Agent failed to become healthy within timeout: ${this.formatError(error)}`);
        }
        console.log(`Health check failed, retrying... (${attempts}/${maxAttempts}): ${this.formatError(error)}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error("Agent failed to become healthy within timeout (20 minutes)");
  }

  private getEnvironmentVariables() {
    const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'VELLUM_API_KEY', 'NEON_API_KEY'];
    const optionalVars = ['GITHUB_TOKEN'];
    const envVars: Record<string, string> = {};

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Required environment variable ${varName} is not set`);
      }
      envVars[varName] = value;
    }

    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value) {
        envVars[varName] = value;
      }
    }

    return envVars;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: npx tsx scripts/create-agent.ts <agent-name>");
    console.error("Example: npx tsx scripts/create-agent.ts my-agent");
    console.error("Example: npx tsx scripts/create-agent.ts pr-123");
    process.exit(1);
  }

  const agentName = args[0];

  if (!/^[a-zA-Z0-9-]+$/.test(agentName)) {
    console.error("Agent name must contain only letters, numbers, and hyphens");
    process.exit(1);
  }

  const prMatch = agentName.match(/^pr-(\d+)$/);
  const prNumber = prMatch ? prMatch[1] : undefined;

  const creator = new VargasJRAgentCreator({
    name: agentName,
    prNumber: prNumber
  });
  await creator.createAgent();
}

if (require.main === module) {
  main().catch(console.error);
}
