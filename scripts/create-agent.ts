#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { SSM } from "@aws-sdk/client-ssm";
import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { findInstancesByFilters, terminateInstances, waitForInstancesTerminated, findOrCreateSecurityGroup, createSecret, getNeonPreviewDatabaseUrl, checkInstanceHealth, findOrCreateSSMInstanceProfile, validateSSMReadiness } from "./utils";
import { VARGASJR_IMAGE_NAME } from "../app/lib/constants";

interface AgentConfig {
  name: string;
  instanceType?: string;
  region?: string;
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

  constructor(config: AgentConfig) {
    this.config = {
      instanceType: config.prNumber ? "t3.small" : "t3.micro",
      region: "us-east-1",
      ...config
    };
    this.ec2 = new EC2({ region: this.config.region });
  }

  async createAgent(): Promise<void> {
    const agentName = this.config.prNumber ? `pr-${this.config.prNumber}` : this.config.name;
    const instanceName = `vargas-jr-${agentName}`;
    const overallStartTime = Date.now();
    const timingResults: TimingResult[] = [];
    
    console.log(`Creating Vargas JR agent: ${agentName}`);

    try {
      let startTime = Date.now();
      await this.deleteExistingInstances(instanceName);
      timingResults.push({
        method: 'deleteExistingInstances',
        duration: Date.now() - startTime,
        success: true
      });

      const keyPairName = `${agentName}-key`;
      startTime = Date.now();
      await this.createKeyPair(keyPairName);
      timingResults.push({
        method: 'createKeyPair',
        duration: Date.now() - startTime,
        success: true
      });

      console.log("Waiting for key pair to propagate in AWS...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      startTime = Date.now();
      const instanceId = await this.createEC2Instance(keyPairName);
      timingResults.push({
        method: 'createEC2Instance',
        duration: Date.now() - startTime,
        success: true
      });

      startTime = Date.now();
      await this.waitForInstanceRunning(instanceId);
      timingResults.push({
        method: 'waitForInstanceRunning',
        duration: Date.now() - startTime,
        success: true
      });

      const instanceDetails = await this.getInstanceDetails(instanceId);

      startTime = Date.now();
      const setupTimingResults = await this.setupInstance(instanceDetails, keyPairName);
      const setupDuration = Date.now() - startTime;
      timingResults.push({
        method: 'setupInstance',
        duration: setupDuration,
        success: true
      });
      timingResults.push(...setupTimingResults);

      startTime = Date.now();
      try {
        await checkInstanceHealth(instanceId, this.config.region);
        timingResults.push({
          method: 'checkInstanceHealth',
          duration: Date.now() - startTime,
          success: true
        });
      } catch (error) {
        timingResults.push({
          method: 'checkInstanceHealth',
          duration: Date.now() - startTime,
          success: false
        });
        const errorMessage = this.formatError(error);
        console.error(`⚠️  Health check failed: ${errorMessage}`);
        console.log("Continuing with agent setup despite health check failure...");
      }

      const totalDuration = Date.now() - overallStartTime;
      
      console.log(`✅ Agent ${agentName} infrastructure and SSM setup completed successfully!`);
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

  private async getLatestCustomAMI(): Promise<string> {
    console.log("Looking for latest custom VargasJR AMI...");
    
    const images = await this.ec2.describeImages({
      Owners: ['self'],
      Filters: [
        { Name: 'name', Values: [VARGASJR_IMAGE_NAME] },
        { Name: 'state', Values: ['available'] }
      ]
    });
    
    const sortedImages = images.Images?.sort((a, b) => 
      new Date(b.CreationDate!).getTime() - new Date(a.CreationDate!).getTime()
    );
    
    if (!sortedImages?.length) {
      console.warn('No custom VargasJR AMI found. This is expected for new PRs before terraform is deployed.');
      console.warn('Falling back to base Ubuntu AMI. Note: This may require Node.js to be installed manually.');
      return "ami-0e2c8caa4b6378d8c";
    }
    
    const customAmiId = sortedImages[0].ImageId!;
    console.log(`Found custom AMI: ${customAmiId} (${sortedImages[0].Name})`);
    return customAmiId;
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
      console.warn('Using Default Host Management Configuration approach:', error);
    }

    const imageId = await this.getLatestCustomAMI();

    const result = await this.ec2.runInstances({
      ImageId: imageId,
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

  private async setupInstance(instanceDetails: any, keyPairName: string): Promise<TimingResult[]> {
    console.log(`Basic setup for Vargas JR agent instance: ${instanceDetails.instanceId}`);
    console.log(`Instance available at: ${instanceDetails.publicDns}`);
    console.log(`Key pair created: ${keyPairName}`);

    const setupTimingResults: TimingResult[] = [];

    try {
      let startTime = Date.now();
      await this.waitForSSMReady(instanceDetails.instanceId);
      setupTimingResults.push({
        method: 'setupInstance.waitForSSMReady',
        duration: Date.now() - startTime,
        success: true
      });

      startTime = Date.now();
      const envVars = this.getEnvironmentVariables();

      let postgresUrl: string;
      if (this.config.prNumber) {
        postgresUrl = await getNeonPreviewDatabaseUrl();
      } else {
        postgresUrl = process.env.POSTGRES_URL || '';
      }

      let envContent = `POSTGRES_URL=${postgresUrl}
LOG_LEVEL=INFO
VELLUM_API_KEY=${envVars.VELLUM_API_KEY}`;

      if (this.config.prNumber) {
        envContent += `
AGENT_ENVIRONMENT=preview
PR_NUMBER=${this.config.prNumber}
GITHUB_TOKEN=${envVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''}`;
      } else {
        envContent += `
AGENT_ENVIRONMENT=production`;
      }

      writeFileSync('/tmp/agent.env', envContent);
      
      const keyPath = `${tmpdir()}/${keyPairName}.pem`;
      console.log("Copying .env file to instance...");
      await this.executeSCPCommand(keyPath, instanceDetails.publicDns, '/tmp/agent.env', '~/.env');
      console.log("Copying run_agent.sh script to instance...");
      await this.executeSCPCommand(keyPath, instanceDetails.publicDns, './scripts/run_agent.sh', '~/run_agent.sh');
      
      setupTimingResults.push({
        method: 'setupInstance.environmentSetup',
        duration: Date.now() - startTime,
        success: true
      });

      startTime = Date.now();
      const setupCommands = [
        { tag: 'APT', command: 'sudo apt update' },
        { tag: 'UNZIP', command: 'sudo apt install -y unzip' },
        { tag: 'SSM_STATUS', command: 'sudo systemctl is-active snap.amazon-ssm-agent.amazon-ssm-agent.service || sudo snap start amazon-ssm-agent' },
        { tag: 'PROFILE', command: '[ -f ~/.profile ] && . ~/.profile || true' }
      ];

      console.log(`📋 Starting setup commands execution (${setupCommands.length} commands total)`);
      for (let i = 0; i < setupCommands.length; i++) {
        const commandObj = setupCommands[i];
        console.log(`🔄 [${i + 1}/${setupCommands.length}] About to execute: [${commandObj.tag}] ${commandObj.command}`);
        
        try {
          await this.executeSSMCommand(instanceDetails.instanceId, commandObj, 300, false);
          console.log(`✅ [${i + 1}/${setupCommands.length}] Successfully completed: [${commandObj.tag}]`);
        } catch (error) {
          console.error(`⚠️ [${i + 1}/${setupCommands.length}] Setup command failed but continuing: [${commandObj.tag}] ${commandObj.command}`);
          console.error(`Error: ${this.formatError(error)}`);
        }
      }
      console.log(`📋 Completed setup commands execution`)
      
      setupTimingResults.push({
        method: 'setupInstance.dependencyInstallation',
        duration: Date.now() - startTime,
        success: true
      });

      startTime = Date.now();
      console.log("Making run_agent.sh executable and running it...");
      await this.executeSSMCommand(instanceDetails.instanceId, { tag: 'CHMOD', command: 'chmod +x /home/ubuntu/run_agent.sh' });
      await this.executeSSMCommand(instanceDetails.instanceId, { tag: 'AGENT', command: 'cd /home/ubuntu && ./run_agent.sh' }, 600);
      
      setupTimingResults.push({
        method: 'setupInstance.agentDeployment',
        duration: Date.now() - startTime,
        success: true
      });

      console.log("✅ Instance setup complete!");

      console.log("Waiting for SSM agent to register with Systems Manager...");
      console.log("Note: Using snap-installed SSM agent service name for Ubuntu 24.04");
      console.log("Note: MetadataOptions enforce IMDSv2 which is required for SSM registration");
      console.log("Using IAM instance profile for reliable SSM registration");
      await new Promise(resolve => setTimeout(resolve, 30000));

      return setupTimingResults;

    } catch (error) {
      console.error(`❌ Failed to setup instance: ${error}`);
      throw error;
    }
  }

  private async waitForSSMReady(instanceId: string): Promise<void> {
    const maxAttempts = 40;
    let attempts = 0;

    console.log(`Waiting for SSM agent to be ready on instance: ${instanceId}`);

    while (attempts < maxAttempts) {
      try {
        const ssmValidation = await validateSSMReadiness(instanceId);
        if (ssmValidation.ready) {
          console.log("✅ SSM is ready");
          return;
        }
        
        attempts++;
        const waitTime = attempts < 10 ? 10 : 15;
        console.log(`SSM not ready yet, attempt ${attempts}/${maxAttempts}. Waiting ${waitTime} seconds...`);
        console.log(`SSM error: ${ssmValidation.error}`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } catch (error) {
        attempts++;
        const waitTime = attempts < 10 ? 10 : 15;
        console.log(`SSM validation failed, attempt ${attempts}/${maxAttempts}. Waiting ${waitTime} seconds...`);
        console.log(`SSM error: ${this.formatError(error)}`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }

    throw new Error("SSM failed to become ready within timeout (10 minutes). Check SSM agent installation and IAM permissions.");
  }

  private async executeSSMCommand(instanceId: string, commandObj: { tag: string; command: string }, timeoutSeconds: number = 300, enableDiagnostics: boolean = true): Promise<void> {
    console.log(`[${commandObj.tag}] Executing: ${commandObj.command}`);

    const maxAttempts = 3;
    let attempts = 0;
    const ssm = new SSM({ region: "us-east-1" });

    while (attempts < maxAttempts) {
      try {
        const commandResult = await ssm.sendCommand({
          InstanceIds: [instanceId],
          DocumentName: "AWS-RunShellScript",
          Parameters: {
            commands: [commandObj.command],
          },
          TimeoutSeconds: timeoutSeconds,
        });

        const commandId = commandResult.Command?.CommandId;
        if (!commandId) {
          throw new Error("Failed to get command ID from SSM");
        }

        let pollAttempts = 0;
        const maxPollAttempts = 60;
        
        while (pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const outputResult = await ssm.getCommandInvocation({
            CommandId: commandId,
            InstanceId: instanceId,
          });

          if (outputResult.Status === "Success") {
            const output = outputResult.StandardOutputContent || "";
            if (output.trim()) {
              output.split('\n').forEach(line => {
                if (line.trim()) {
                  console.log(`[${commandObj.tag}] ${line}`);
                }
              });
            }
            return;
          } else if (outputResult.Status === "Failed") {
            const errorDetails = outputResult.StandardErrorContent || "No error details available";
            const outputDetails = outputResult.StandardOutputContent || "No output";
            throw new Error(`SSM command failed: ${errorDetails}\nCommand output: ${outputDetails}`);
          }
          
          pollAttempts++;
        }
        
        throw new Error(`SSM command timed out after ${timeoutSeconds} seconds`);
      } catch (error: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`❌ [${commandObj.tag}] SSM command failed after ${maxAttempts} attempts: ${commandObj.command}`);
          
          if (enableDiagnostics) {
            console.error(`Error: ${this.formatError(error)}`);
            await this.executeDiagnosticCommands(instanceId);
            console.error('\n💀 Script terminated due to SSM command failure. See diagnostic information above.');
            process.exit(1);
          }
          
          throw error;
        }
        console.log(`[${commandObj.tag}] SSM command failed, retrying... (${attempts}/${maxAttempts})`);
        console.error(`Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async executeDiagnosticCommands(instanceId: string): Promise<void> {
    console.log('\n🔍 Executing diagnostic commands to gather error information...');
    
    try {
      console.log('📄 Checking for error.log...');
      await this.executeSSMCommand(instanceId, {
        tag: 'ERROR_LOG',
        command: 'if [ -f /home/ubuntu/error.log ]; then echo "=== ERROR.LOG CONTENTS ==="; cat /home/ubuntu/error.log; else echo "No error.log file found"; fi'
      }, 60, false);
    } catch (error) {
      console.error(`Failed to read error.log: ${this.formatError(error)}`);
    }

    try {
      console.log('\n📁 Listing agent directory...');
      await this.executeSSMCommand(instanceId, {
        tag: 'AGENT_DIR',
        command: 'echo "=== AGENT DIRECTORY LISTING ==="; ls -la /home/ubuntu/agent/ 2>/dev/null || echo "Agent directory not found"'
      }, 60, false);
    } catch (error) {
      console.error(`Failed to list agent directory: ${this.formatError(error)}`);
    }

    try {
      console.log('\n📁 Listing worker directory...');
      await this.executeSSMCommand(instanceId, {
        tag: 'WORKER_DIR',
        command: 'echo "=== WORKER DIRECTORY LISTING ==="; ls -la /home/ubuntu/worker/ 2>/dev/null || echo "Worker directory not found"'
      }, 60, false);
    } catch (error) {
      console.error(`Failed to list worker directory: ${this.formatError(error)}`);
    }

    try {
      console.log('\n🔧 Checking build artifacts...');
      await this.executeSSMCommand(instanceId, {
        tag: 'BUILD_CHECK',
        command: 'echo "=== BUILD ARTIFACTS CHECK ==="; if [ -f /home/ubuntu/*/worker/dist/index.js ]; then echo "✅ worker/dist/index.js found"; ls -la /home/ubuntu/*/worker/dist/; else echo "❌ worker/dist/index.js missing"; find /home/ubuntu -name "index.js" -type f 2>/dev/null || echo "No index.js files found"; fi'
      }, 60, false);
    } catch (error) {
      console.error(`Failed to check build artifacts: ${this.formatError(error)}`);
    }
  }

  private async executeSCPCommand(keyPath: string, publicDns: string, localPath: string, remotePath: string): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = execSync(`scp -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o UserKnownHostsFile=/dev/null ${localPath} ubuntu@${publicDns}:${remotePath}`, {
          stdio: 'pipe',
          encoding: 'utf8'
        });
        
        if (result) {
          result.toString().split('\n').forEach(line => {
            if (line.trim()) {
              console.log(`[SCP] ${line}`);
            }
          });
        }
        return;
      } catch (error: any) {
        if (error.stdout) {
          error.stdout.toString().split('\n').forEach((line: string) => {
            if (line.trim()) {
              console.log(`[SCP] ${line}`);
            }
          });
        }
        if (error.stderr) {
          error.stderr.toString().split('\n').forEach((line: string) => {
            if (line.trim()) {
              console.error(`[SCP] ${line}`);
            }
          });
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`❌ SCP command failed after ${maxAttempts} attempts: ${localPath} -> ${remotePath}`);
          throw error;
        }
        console.log(`[SCP] SCP command failed, retrying... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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

  private reportTimingResults(timingResults: TimingResult[], totalDuration: number): void {
    console.log("\n📊 Agent Creation Timing Report");
    console.log("=" + "=".repeat(50));
    console.log(`Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log("");
    
    const successful = timingResults.filter(r => r.success);
    const failed = timingResults.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log(`✅ Successful Methods (${successful.length}):`);
      for (const result of successful) {
        const percentage = ((result.duration / totalDuration) * 100).toFixed(1);
        console.log(`  ${result.method}: ${result.duration}ms (${percentage}%)`);
      }
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed Methods (${failed.length}):`);
      for (const result of failed) {
        const percentage = ((result.duration / totalDuration) * 100).toFixed(1);
        console.log(`  ${result.method}: ${result.duration}ms (${percentage}%)`);
      }
    }
    
    console.log("=" + "=".repeat(50));
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
