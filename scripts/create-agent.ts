#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";

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
    console.log(`Creating Vargas JR agent: ${agentName}`);
    
    try {
      const keyPairName = `${agentName}-key`;
      await this.createKeyPair(keyPairName);
      
      const instanceId = await this.createEC2Instance(keyPairName);
      
      await this.waitForInstanceRunning(instanceId);
      
      const instanceDetails = await this.getInstanceDetails(instanceId);
      
      await this.setupInstance(instanceDetails, keyPairName);
      
      console.log(`✅ Agent ${agentName} created successfully!`);
      console.log(`Instance ID: ${instanceId}`);
      console.log(`Public DNS: ${instanceDetails.publicDns}`);
      
    } catch (error) {
      console.error(`❌ Failed to create agent: ${error}`);
      process.exit(1);
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
        const sshDir = `${process.env.HOME}/.ssh`;
        const keyPath = `${sshDir}/${keyPairName}.pem`;
        
        mkdirSync(sshDir, { recursive: true, mode: 0o700 });
        
        writeFileSync(keyPath, result.KeyMaterial, { mode: 0o600 });
        console.log(`✅ Key pair saved to ${keyPath}`);
      }
    } catch (error: any) {
      if (error.name === "InvalidKeyPair.Duplicate") {
        console.log(`⚠️  Key pair ${keyPairName} already exists, skipping creation`);
      } else {
        throw error;
      }
    }
  }

  private async createEC2Instance(keyPairName: string): Promise<string> {
    console.log("Creating EC2 instance...");
    
    const result = await this.ec2.runInstances({
      ImageId: "ami-0c02fb55956c7d316",
      InstanceType: this.config.instanceType as any,
      KeyName: keyPairName,
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
    console.log(`Setting up Vargas JR agent on ${instanceDetails.publicDns}`);
    
    console.log("Waiting for SSH to be ready...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const envVars = this.getEnvironmentVariables();
    
    try {
      const dbName = this.config.name.replace('-', '_');
      const envContent = `POSTGRES_URL=postgresql://postgres:password@localhost:5432/vargasjr_${dbName}
LOG_LEVEL=INFO
VELLUM_API_KEY=${envVars.VELLUM_API_KEY}
AWS_ACCESS_KEY_ID=${envVars.AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${envVars.AWS_SECRET_ACCESS_KEY}
AWS_DEFAULT_REGION=us-east-1`;

      writeFileSync('/tmp/agent.env', envContent);
      const setupCommands = [
        'sudo apt update',
        'sudo apt install -y python3.12 python3.12-venv python3-pip postgresql postgresql-contrib',
        'sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1',
        'sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1',
        'sudo systemctl start postgresql',
        'sudo systemctl enable postgresql',
        `sudo -u postgres createdb vargasjr_${dbName}`,
        'sudo -u postgres psql -c "ALTER USER postgres PASSWORD \'password\';"',
        'curl -sSL https://install.python-poetry.org | python - -y --version 1.8.3',
        'source ~/.profile'
      ];
      
      const keyPath = `${process.env.HOME}/.ssh/${keyPairName}.pem`;
      
      // Execute setup commands
      for (const command of setupCommands) {
        console.log(`Executing: ${command}`);
        execSync(`ssh -i ${keyPath} -o StrictHostKeyChecking=no ubuntu@${instanceDetails.publicDns} "${command}"`, {
          stdio: 'inherit'
        });
      }
      
      console.log("Copying .env file to instance...");
      execSync(`scp -i ${keyPath} -o StrictHostKeyChecking=no /tmp/agent.env ubuntu@${instanceDetails.publicDns}:~/.env`, {
        stdio: 'inherit'
      });
      
      console.log("✅ Instance setup complete!");
      
    } catch (error) {
      console.error(`❌ Failed to setup instance: ${error}`);
      throw error;
    }
  }
  
  private getEnvironmentVariables() {
    const requiredVars = ['VELLUM_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    const envVars: Record<string, string> = {};
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Required environment variable ${varName} is not set`);
      }
      envVars[varName] = value;
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
