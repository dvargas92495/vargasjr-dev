#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { SSM } from "@aws-sdk/client-ssm";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import {
  findInstancesByFilters,
  terminateInstances,
  waitForInstancesTerminated,
  findOrCreateSecurityGroup,
  createSecret,
  getNeonPreviewDatabaseUrl,
  checkInstanceHealth,
  findOrCreateSSMInstanceProfile,
  toSshKeySecretName,
  toAgentName,
} from "./utils";
import { VARGASJR_IMAGE_NAME } from "../app/lib/constants";
import { getGitHubAuthHeaders, GitHubAppAuth } from "../app/lib/github-auth";
import {
  AWS_DEFAULT_REGION,
  DEFAULT_PRODUCTION_AGENT_NAME,
} from "@/server/constants";

interface AgentConfig {
  prNumber?: string;
}

interface TimingResult {
  method: string;
  duration: number;
  success: boolean;
}

class VargasJRAgentCreator {
  private ec2: EC2;
  private config: AgentConfig;
  private instanceName: string;
  private keyPairName: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.ec2 = new EC2({ region: AWS_DEFAULT_REGION });
    this.instanceName = toAgentName(this.config.prNumber);
    this.keyPairName = toSshKeySecretName(this.instanceName);
  }

  async createAgent(): Promise<void> {
    const overallStartTime = Date.now();
    const timingResults: TimingResult[] = [];

    console.log(`Creating Vargas JR agent: ${this.instanceName}`);

    try {
      let startTime = Date.now();
      await this.deleteExistingInstances();
      timingResults.push({
        method: "deleteExistingInstances",
        duration: Date.now() - startTime,
        success: true,
      });

      startTime = Date.now();
      await this.createKeyPair();
      timingResults.push({
        method: "createKeyPair",
        duration: Date.now() - startTime,
        success: true,
      });

      console.log("Waiting for key pair to propagate in AWS...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      startTime = Date.now();
      const instanceId = await this.createEC2Instance();
      timingResults.push({
        method: "createEC2Instance",
        duration: Date.now() - startTime,
        success: true,
      });

      startTime = Date.now();
      await this.waitForInstanceRunning(instanceId);
      timingResults.push({
        method: "waitForInstanceRunning",
        duration: Date.now() - startTime,
        success: true,
      });

      const instanceDetails = await this.getInstanceDetails(instanceId);

      startTime = Date.now();
      const setupTimingResults = await this.setupInstance(instanceDetails);
      const setupDuration = Date.now() - startTime;
      timingResults.push({
        method: "setupInstance",
        duration: setupDuration,
        success: true,
      });
      timingResults.push(...setupTimingResults);

      startTime = Date.now();
      await this.waitForInstanceReady(instanceId);
      timingResults.push({
        method: "waitForInstanceReady",
        duration: Date.now() - startTime,
        success: true,
      });

      const totalDuration = Date.now() - overallStartTime;

      console.log(
        `✅ Agent ${this.instanceName} infrastructure and SSM setup completed successfully!`
      );
      console.log(`Instance ID: ${instanceId}`);
      console.log(`Public DNS: ${instanceDetails.publicDns}`);

      this.reportTimingResults(timingResults, totalDuration);
    } catch (error) {
      const totalDuration = Date.now() - overallStartTime;
      console.error(`❌ Failed to create agent: ${error}`);

      if (timingResults.length > 0) {
        console.log("\n📊 Timing results before failure:");
        this.reportTimingResults(timingResults, totalDuration);
      }

      process.exit(1);
    }
  }

  private async deleteExistingInstances(): Promise<void> {
    const existingInstances = await findInstancesByFilters(this.ec2, [
      { Name: "tag:Name", Values: [this.instanceName] },
      { Name: "tag:Project", Values: ["VargasJR"] },
      {
        Name: "instance-state-name",
        Values: ["running", "stopped", "pending"],
      },
    ]);

    if (existingInstances.length === 0) {
      console.log(
        `No existing instances found with name: ${this.instanceName}`
      );
      return;
    }

    console.log(
      `Found ${existingInstances.length} existing instance(s) with name: ${this.instanceName}`
    );

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

  private async createKeyPair(): Promise<void> {
    console.log(`Creating key pair: ${this.keyPairName}`);

    try {
      const result = await this.ec2.createKeyPair({
        KeyName: this.keyPairName,
        KeyType: "rsa",
        KeyFormat: "pem",
      });

      if (result.KeyMaterial) {
        const keyPath = `${tmpdir()}/${this.keyPairName}.pem`;

        writeFileSync(keyPath, result.KeyMaterial, { mode: 0o600 });
        console.log(`✅ Key pair saved to ${keyPath}`);

        await createSecret(this.keyPairName, result.KeyMaterial);
      }
    } catch (error: any) {
      if (error.name === "InvalidKeyPair.Duplicate") {
        console.log(
          `⚠️  Key pair ${this.keyPairName} already exists, skipping creation`
        );

        console.log(
          `Deleting existing key pair to recreate with new material...`
        );
        try {
          await this.ec2.deleteKeyPair({ KeyName: this.keyPairName });
          console.log(`✅ Deleted existing key pair: ${this.keyPairName}`);

          const newResult = await this.ec2.createKeyPair({
            KeyName: this.keyPairName,
            KeyType: "rsa",
            KeyFormat: "pem",
          });

          if (newResult.KeyMaterial) {
            const keyPath = `${tmpdir()}/${this.keyPairName}.pem`;

            writeFileSync(keyPath, newResult.KeyMaterial, { mode: 0o600 });
            console.log(`✅ Key pair recreated and saved to ${keyPath}`);

            await createSecret(this.keyPairName, newResult.KeyMaterial);
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

  private async getLatestCustomAMI(): Promise<string> {
    console.log("Looking for latest custom VargasJR AMI...");

    const images = await this.ec2.describeImages({
      Owners: ["self"],
      Filters: [
        { Name: "name", Values: [`${VARGASJR_IMAGE_NAME}-*`] },
        { Name: "state", Values: ["available"] },
      ],
    });

    const sortedImages = images.Images?.sort(
      (a, b) =>
        new Date(b.CreationDate!).getTime() -
        new Date(a.CreationDate!).getTime()
    );

    if (!sortedImages?.length) {
      throw new Error(
        `No custom VargasJR AMI found with name pattern '${VARGASJR_IMAGE_NAME}-*'. ` +
          `Ensure Terraform has been deployed to create the custom AMI before running this script.`
      );
    }

    const customAmiId = sortedImages[0].ImageId!;
    console.log(`Found custom AMI: ${customAmiId} (${sortedImages[0].Name})`);
    return customAmiId;
  }

  private async getOpenPRNumbers(): Promise<string[]> {
    const githubRepo = "dvargas92495/vargasjr-dev";

    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/pulls?state=open`,
        {
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const prs = await response.json();
      return prs.map((pr: any) => pr.number.toString());
    } catch (error) {
      console.warn(`⚠️  Failed to fetch open PRs from GitHub: ${error}`);
      return [];
    }
  }

  private async findOrphanedInstances(): Promise<string[]> {
    console.log(`🔍 Searching for orphaned instances in us-east-1...`);

    const openPRNumbers = await this.getOpenPRNumbers();
    console.log(
      `Found ${openPRNumbers.length} open PRs: ${openPRNumbers.join(", ")}`
    );

    const orphanedInstanceIds: string[] = [];

    try {
      const allInstances = await findInstancesByFilters(this.ec2, [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:Type", Values: ["preview"] },
        {
          Name: "instance-state-name",
          Values: ["running", "stopped", "pending"],
        },
      ]);

      for (const instance of allInstances) {
        const prNumberTag = instance.Tags?.find(
          (tag: any) => tag.Key === "PRNumber"
        )?.Value;
        if (prNumberTag && !openPRNumbers.includes(prNumberTag)) {
          console.log(
            `Found orphaned instance: ${instance.InstanceId} (PR #${prNumberTag})`
          );
          orphanedInstanceIds.push(instance.InstanceId!);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to check instances: ${this.formatError(error)}`);
    }

    return orphanedInstanceIds;
  }

  private async createEC2Instance(): Promise<string> {
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
      console.warn(
        "Using Default Host Management Configuration approach:",
        error
      );
    }

    const imageId = await this.getLatestCustomAMI();

    try {
      return await this.createSingleInstance(
        imageId,
        securityGroupId,
        iamInstanceProfile
      );
    } catch (error: any) {
      const errorMessage = this.formatError(error);

      if (
        error.name === "VcpuLimitExceeded" ||
        errorMessage.includes("VcpuLimitExceeded")
      ) {
        console.log(
          `⚠️  vCPU limit exceeded, attempting to clean up orphaned instances...`
        );

        const orphanedInstanceIds = await this.findOrphanedInstances();

        if (orphanedInstanceIds.length === 0) {
          throw new Error(
            `vCPU limit exceeded and no orphaned instances found to clean up. Please manually increase vCPU limits or terminate unused instances.`
          );
        }

        console.log(
          `Terminating ${
            orphanedInstanceIds.length
          } orphaned instance(s): ${orphanedInstanceIds.join(", ")}`
        );

        if (orphanedInstanceIds.length > 0) {
          await terminateInstances(this.ec2, orphanedInstanceIds);
          await waitForInstancesTerminated(this.ec2, orphanedInstanceIds);
        }

        console.log(`✅ Cleanup complete. Retrying instance creation...`);

        await new Promise((resolve) => setTimeout(resolve, 10000));

        return await this.createSingleInstance(
          imageId,
          securityGroupId,
          iamInstanceProfile
        );
      } else {
        throw error;
      }
    }
  }

  private async createSingleInstance(
    imageId: string,
    securityGroupId: string,
    iamInstanceProfile?: string
  ): Promise<string> {
    const userData = `#!/bin/bash
cd /home/ubuntu

# Create systemd service for automatic agent startup
cat > /etc/systemd/system/vargasjr-agent.service << 'EOF'
[Unit]
Description=VargasJR Agent Service
After=network.target cloud-final.service
Wants=network.target

[Service]
Type=forking
RemainAfterExit=yes
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/bin/bash /home/ubuntu/run_agent.sh
Restart=on-failure
RestartSec=30
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=HOME=/home/ubuntu

[Install]
WantedBy=multi-user.target
EOF

# Enable the service (but don't start it yet - let it start after files are copied)
systemctl enable vargasjr-agent.service

# Log the service creation
echo "VargasJR agent service created and enabled" >> /var/log/vargasjr-startup.log
`;

    const result = await this.ec2.runInstances({
      ImageId: imageId,
      InstanceType: "t3.micro",
      KeyName: this.keyPairName,
      SecurityGroupIds: [securityGroupId],
      UserData: Buffer.from(userData).toString("base64"),
      ...(iamInstanceProfile && {
        IamInstanceProfile: {
          Name: iamInstanceProfile,
        },
      }),
      MetadataOptions: {
        HttpTokens: "required",
        HttpPutResponseHopLimit: 1,
        HttpEndpoint: "enabled",
      },
      MinCount: 1,
      MaxCount: 1,
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            {
              Key: "Name",
              Value: this.instanceName,
            },
            { Key: "Project", Value: "VargasJR" },
            { Key: "CreatedBy", Value: "create-agent-script" },
            { Key: "PRNumber", Value: this.config.prNumber || "" },
            { Key: "Type", Value: this.config.prNumber ? "preview" : "main" },
          ],
        },
      ],
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
    await new Promise((resolve) => setTimeout(resolve, 10000));

    let attempts = 0;
    const maxAttempts = 40;

    while (attempts < maxAttempts) {
      try {
        const result = await this.ec2.describeInstances({
          InstanceIds: [instanceId],
        });

        const instance = result.Reservations?.[0]?.Instances?.[0];
        if (instance?.State?.Name === "running") {
          console.log("✅ Instance is running");
          return;
        }

        attempts++;
        console.log(
          `Instance state: ${instance?.State?.Name}, waiting... (${attempts}/${maxAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, 15000));
      } catch (error: any) {
        if (error.name === "InvalidInstanceID.NotFound" && attempts < 5) {
          console.log(
            `Instance not yet available in API, retrying... (${attempts + 1}/5)`
          );
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 10000));
          continue;
        }
        throw error;
      }
    }

    throw new Error("Instance failed to reach running state within timeout");
  }

  private async getInstanceDetails(instanceId: string) {
    const result = await this.ec2.describeInstances({
      InstanceIds: [instanceId],
    });

    const instance = result.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      throw new Error("Failed to get instance details");
    }

    return {
      instanceId,
      publicDns: instance.PublicDnsName || "",
      publicIp: instance.PublicIpAddress || "",
    };
  }

  private async setupInstance(instanceDetails: any): Promise<TimingResult[]> {
    console.log(
      `Basic setup for Vargas JR agent instance: ${instanceDetails.instanceId}`
    );
    console.log(`Instance available at: ${instanceDetails.publicDns}`);
    console.log(`Key pair created: ${this.keyPairName}`);

    const setupTimingResults: TimingResult[] = [];

    try {
      console.log("Waiting for SSM agent to be ready for commands...");
      await new Promise((resolve) => setTimeout(resolve, 30000));

      let startTime = Date.now();
      const envVars = this.getEnvironmentVariables();

      let postgresUrl: string;
      if (this.config.prNumber) {
        postgresUrl = await getNeonPreviewDatabaseUrl();
      } else {
        postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL || "";
      }

      let envContent = `POSTGRES_URL=${postgresUrl}
LOG_LEVEL=INFO
VELLUM_API_KEY=${envVars.VELLUM_API_KEY}
ADMIN_TOKEN=${envVars.ADMIN_TOKEN}`;

      if (this.config.prNumber) {
        const githubAuth = new GitHubAppAuth();
        const githubToken = await githubAuth.getInstallationToken();

        envContent += `
AGENT_ENVIRONMENT=preview
PR_NUMBER=${this.config.prNumber}
GITHUB_TOKEN=${githubToken}`;
      } else {
        envContent += `
AGENT_ENVIRONMENT=production`;
      }

      writeFileSync("/tmp/agent.env", envContent);

      const keyPath = `${tmpdir()}/${this.keyPairName}.pem`;
      console.log("Copying .env file to instance...");
      await this.executeSCPCommand(
        keyPath,
        instanceDetails.publicDns,
        "/tmp/agent.env",
        "~/.env"
      );
      console.log("Copying run_agent.sh script to instance...");
      await this.executeSCPCommand(
        keyPath,
        instanceDetails.publicDns,
        "./scripts/run_agent.sh",
        "~/run_agent.sh"
      );

      setupTimingResults.push({
        method: "setupInstance.environmentSetup",
        duration: Date.now() - startTime,
        success: true,
      });

      startTime = Date.now();
      const setupCommands = [
        { tag: "APT", command: "sudo apt update" },
        { tag: "UNZIP", command: "sudo apt install -y unzip" },
        {
          tag: "PROFILE",
          command: "[ -f ~/.profile ] && . ~/.profile || true",
        },
        {
          tag: "CHMOD",
          command: "chmod +x /home/ubuntu/run_agent.sh",
        },
        {
          tag: "VALIDATE_DIST",
          command: "test -f /home/ubuntu/dist/worker.js || (echo 'ERROR: dist/worker.js not found' && exit 1)",
        },
        {
          tag: "VALIDATE_PLAYWRIGHT",
          command: "test -d /home/ubuntu/dist/node_modules/playwright-core || (echo 'ERROR: playwright-core not found' && exit 1)",
        },
        {
          tag: "START_SERVICE",
          command:
            "sudo systemctl start vargasjr-agent.service && sleep 3 && sudo systemctl is-active vargasjr-agent.service && sudo systemctl status vargasjr-agent.service --no-pager -l",
        },
      ];

      console.log(
        `📋 Starting setup commands execution (${setupCommands.length} commands total)`
      );

      let failureCount = 0;
      const maxFailures = 3;

      for (let i = 0; i < setupCommands.length; i++) {
        const commandObj = setupCommands[i];

        try {
          await this.executeSSHCommand(
            keyPath,
            instanceDetails.publicDns,
            commandObj.command,
            commandObj.tag
          );
          console.log(
            `✅ [${i + 1}/${setupCommands.length}] Successfully completed: [${
              commandObj.tag
            }]`
          );
        } catch (error) {
          failureCount++;
          console.error(
            `❌ [${i + 1}/${setupCommands.length}] Setup command failed: [${
              commandObj.tag
            }] ${commandObj.command}`
          );
          console.error(`Error details: ${this.formatError(error)}`);

          if (commandObj.tag === "START_SERVICE") {
            console.error(
              `🔍 START_SERVICE failed - gathering diagnostic information...`
            );
            await this.gatherServiceDiagnostics(
              keyPath,
              instanceDetails.publicDns
            );
          }

          if (failureCount >= maxFailures) {
            console.error(
              `🚨 Reached ${maxFailures} failures - entering diagnostic mode`
            );
            await this.enterDiagnosticMode(keyPath, instanceDetails.publicDns);
            throw new Error(
              `Setup failed after ${maxFailures} command failures`
            );
          }
        }
      }
      setupTimingResults.push({
        method: "setupInstance.dependencyInstallation",
        duration: Date.now() - startTime,
        success: true,
      });

      console.log("✅ Instance setup complete!");

      return setupTimingResults;
    } catch (error) {
      console.error(`❌ Failed to setup instance: ${error}`);
      throw error;
    }
  }

  private async waitForInstanceReady(instanceId: string): Promise<void> {
    const maxAttempts = 8;
    let attempts = 0;

    console.log(`Waiting for instance to be ready: ${instanceId}`);

    while (attempts < maxAttempts) {
      try {
        const healthResult = await checkInstanceHealth(instanceId);
        if (healthResult.status === "healthy") {
          console.log("✅ Instance health check passed");
          return;
        }

        attempts++;
        const waitTime = attempts < 10 ? 10 : 15;
        console.log(
          `Instance not healthy yet, attempt ${attempts}/${maxAttempts}. Waiting ${waitTime} seconds...`
        );
        console.log(`Health check error: ${healthResult.error}`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      } catch (error) {
        attempts++;
        const waitTime = attempts < 10 ? 10 : 15;
        console.log(
          `Health check failed, attempt ${attempts}/${maxAttempts}. Waiting ${waitTime} seconds...`
        );
        console.log(`Health check error: ${this.formatError(error)}`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      }
    }

    throw new Error("Instance failed to become healthy within timeout.");
  }

  private async executeSCPCommand(
    keyPath: string,
    publicDns: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = execSync(
          `scp -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o UserKnownHostsFile=/dev/null ${localPath} ubuntu@${publicDns}:${remotePath}`,
          {
            stdio: "pipe",
            encoding: "utf8",
          }
        );

        if (result) {
          result
            .toString()
            .split("\n")
            .forEach((line) => {
              if (line.trim()) {
                console.log(`[SCP] ${line}`);
              }
            });
        }
        return;
      } catch (error: any) {
        if (error.stdout) {
          error.stdout
            .toString()
            .split("\n")
            .forEach((line: string) => {
              if (line.trim()) {
                console.log(`[SCP] ${line}`);
              }
            });
        }
        if (error.stderr) {
          error.stderr
            .toString()
            .split("\n")
            .forEach((line: string) => {
              if (line.trim()) {
                console.error(`[SCP] ${line}`);
              }
            });
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.error(
            `❌ SCP command failed after ${maxAttempts} attempts: ${localPath} -> ${remotePath}`
          );
          throw error;
        }
        console.log(
          `[SCP] SCP command failed, retrying... (${attempts}/${maxAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async executeSSHCommand(
    keyPath: string,
    publicDns: string,
    command: string,
    tag: string
  ): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;

    console.log(`🔄 About to execute ${tag}: ${command}`);

    while (attempts < maxAttempts) {
      try {
        const sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=30 -o ConnectionAttempts=3 ubuntu@${publicDns} "${command}"`;
        const result = execSync(sshCommand, {
          stdio: "pipe",
          encoding: "utf8",
          timeout: 60000,
        });

        if (result.trim()) {
          result.split("\n").forEach((line) => {
            if (line.trim()) {
              console.log(`[${tag}] ${line}`);
            }
          });
        } else {
          console.log(`[${tag}] Command completed with no output`);
        }
        return;
      } catch (error: any) {
        attempts++;

        console.error(
          `[${tag}] SSH command failed (attempt ${attempts}/${maxAttempts})`
        );
        console.error(`[${tag}] Command: ${command}`);
        console.error(`[${tag}] Error message: ${error.message}`);

        if (error.stdout) {
          console.error(`[${tag}] STDOUT: ${error.stdout.toString()}`);
        }
        if (error.stderr) {
          console.error(`[${tag}] STDERR: ${error.stderr.toString()}`);
        }
        if (error.status) {
          console.error(`[${tag}] Exit code: ${error.status}`);
        }

        if (attempts >= maxAttempts) {
          let detailedError = `SSH command failed after ${maxAttempts} attempts. Command: "${command}". Error: ${error.message}`;
          if (error.stderr) {
            detailedError += `. STDERR: ${error.stderr.toString()}`;
          }
          throw new Error(detailedError);
        }

        console.log(
          `[${tag}] Retrying in 5 seconds... (${attempts}/${maxAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async gatherServiceDiagnostics(
    keyPath: string,
    publicDns: string
  ): Promise<void> {
    console.log(`🔍 Gathering systemd service diagnostics...`);

    const diagnosticCommands = [
      {
        name: "Service Status",
        command: "sudo systemctl status vargasjr-agent.service --no-pager -l",
      },
      {
        name: "Service Logs",
        command:
          "sudo journalctl -u vargasjr-agent.service --no-pager -l --since '5 minutes ago'",
      },
      {
        name: "Service Is-Active",
        command: "sudo systemctl is-active vargasjr-agent.service",
      },
      {
        name: "Service Is-Enabled",
        command: "sudo systemctl is-enabled vargasjr-agent.service",
      },
      {
        name: "Check run_agent.sh exists",
        command: "ls -la /home/ubuntu/run_agent.sh",
      },
      {
        name: "Check .env exists",
        command: "ls -la /home/ubuntu/.env",
      },
      {
        name: "Check dist directory exists",
        command: "ls -la /home/ubuntu/dist/",
      },
      {
        name: "Check worker.js exists",
        command: "ls -la /home/ubuntu/dist/worker.js",
      },
      {
        name: "Check playwright-core exists",
        command: "ls -la /home/ubuntu/dist/node_modules/playwright-core/",
      },
    ];

    for (const diagnostic of diagnosticCommands) {
      try {
        console.log(`📊 Running diagnostic: ${diagnostic.name}`);
        await this.executeSSHCommand(
          keyPath,
          publicDns,
          diagnostic.command,
          `DIAG-${diagnostic.name.replace(/\s+/g, "-")}`
        );
      } catch (error) {
        console.error(
          `⚠️ Diagnostic command failed: ${
            diagnostic.name
          } - ${this.formatError(error)}`
        );
      }
    }
  }

  private async enterDiagnosticMode(
    keyPath: string,
    publicDns: string
  ): Promise<void> {
    console.log(
      `🚨 ENTERING DIAGNOSTIC MODE - Gathering comprehensive error information`
    );
    console.log(`Instance: ${publicDns}`);

    const comprehensiveDiagnostics = [
      {
        name: "System Logs",
        command:
          "sudo journalctl --since '10 minutes ago' --no-pager -l | tail -50",
      },
      {
        name: "Disk Space",
        command: "df -h",
      },
      {
        name: "Memory Usage",
        command: "free -h",
      },
      {
        name: "Process List",
        command: "ps aux | grep -E '(agent|systemd)' | head -20",
      },
      {
        name: "Network Status",
        command: "ss -tuln | head -10",
      },
      {
        name: "Environment Check",
        command: "env | grep -E '(PATH|HOME|USER)'",
      },
      {
        name: "File Permissions",
        command: "ls -la /home/ubuntu/ | grep -E '(run_agent|env)'",
      },
      {
        name: "Systemd Failed Units",
        command: "sudo systemctl --failed --no-pager",
      },
      {
        name: "Build Artifacts Check",
        command: "find /home/ubuntu -name 'dist' -type d -exec ls -la {} \\; 2>/dev/null || echo 'No dist directories found'",
      },
      {
        name: "Agent Package Contents",
        command: "find /home/ubuntu -name 'vargasjr_dev_agent-*' -type d -exec ls -la {} \\; 2>/dev/null || echo 'No agent packages found'",
      },
    ];

    console.log(
      `📋 Running ${comprehensiveDiagnostics.length} comprehensive diagnostic checks...`
    );

    for (const diagnostic of comprehensiveDiagnostics) {
      try {
        console.log(`🔍 Diagnostic: ${diagnostic.name}`);
        await this.executeSSHCommand(
          keyPath,
          publicDns,
          diagnostic.command,
          `COMPREHENSIVE-${diagnostic.name.replace(/\s+/g, "-")}`
        );
      } catch (error) {
        console.error(
          `⚠️ Comprehensive diagnostic failed: ${
            diagnostic.name
          } - ${this.formatError(error)}`
        );
      }
    }

    await this.gatherServiceDiagnostics(keyPath, publicDns);

    console.log(
      `🚨 DIAGNOSTIC MODE COMPLETE - All available error information has been collected`
    );
    console.log(
      `💡 Review the logs above to identify the root cause of the failures`
    );
  }

  private getEnvironmentVariables() {
    const requiredVars = [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "VELLUM_API_KEY",
      "NEON_API_KEY",
      "GITHUB_PRIVATE_KEY",
      "ADMIN_TOKEN",
    ];
    const optionalVars: string[] = [];
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

  private reportTimingResults(
    timingResults: TimingResult[],
    totalDuration: number
  ): void {
    console.log("\n📊 Agent Creation Timing Report");
    console.log("=" + "=".repeat(50));
    console.log(
      `Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(
        1
      )}s)`
    );
    console.log("");

    const successful = timingResults.filter((r) => r.success);
    const failed = timingResults.filter((r) => !r.success);

    if (successful.length > 0) {
      console.log(`✅ Successful Methods (${successful.length}):`);
      for (const result of successful) {
        const percentage = ((result.duration / totalDuration) * 100).toFixed(1);
        console.log(
          `  ${result.method}: ${result.duration}ms (${percentage}%)`
        );
      }
    }

    if (failed.length > 0) {
      console.log(`\n❌ Failed Methods (${failed.length}):`);
      for (const result of failed) {
        const percentage = ((result.duration / totalDuration) * 100).toFixed(1);
        console.log(
          `  ${result.method}: ${result.duration}ms (${percentage}%)`
        );
      }
    }

    console.log("=" + "=".repeat(50));
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    console.error("Usage: npx tsx scripts/create-agent.ts [agent-name]");
    console.error("Example: npx tsx scripts/create-agent.ts my-agent");
    console.error("Example: npx tsx scripts/create-agent.ts pr-123");
    console.error(
      "Example: npx tsx scripts/create-agent.ts (uses default production agent)"
    );
    process.exit(1);
  }

  const agentName = args[0] || DEFAULT_PRODUCTION_AGENT_NAME;

  if (!/^[a-zA-Z0-9-]+$/.test(agentName)) {
    console.error("Agent name must contain only letters, numbers, and hyphens");
    process.exit(1);
  }

  const prMatch = agentName.match(/^pr-(\d+)$/);
  const prNumber = prMatch ? prMatch[1] : undefined;

  const creator = new VargasJRAgentCreator({
    prNumber: prNumber,
  });
  await creator.createAgent();
}

if (require.main === module) {
  main().catch(console.error);
}
