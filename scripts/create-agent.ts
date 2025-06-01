#!/usr/bin/env npx tsx

import { EC2 } from "@aws-sdk/client-ec2";
import { writeFileSync } from "fs";

interface AgentConfig {
  name: string;
  instanceType?: string;
  region?: string;
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
    console.log(`Creating Vargas JR agent: ${this.config.name}`);
    
    try {
      const keyPairName = `${this.config.name}-key`;
      await this.createKeyPair(keyPairName);
      
      const instanceId = await this.createEC2Instance(keyPairName);
      
      await this.waitForInstanceRunning(instanceId);
      
      const instanceDetails = await this.getInstanceDetails(instanceId);
      
      this.generateSetupScript(instanceDetails, keyPairName);
      
      console.log(`✅ Agent ${this.config.name} created successfully!`);
      console.log(`Instance ID: ${instanceId}`);
      console.log(`Public DNS: ${instanceDetails.publicDns}`);
      console.log(`Setup script generated: ./scripts/setup-${this.config.name}.sh`);
      
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
        writeFileSync(`~/.ssh/${keyPairName}.pem`, result.KeyMaterial, { mode: 0o600 });
        console.log(`✅ Key pair saved to ~/.ssh/${keyPairName}.pem`);
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
            { Key: "Name", Value: `vargas-jr-${this.config.name}` },
            { Key: "Project", Value: "VargasJR" },
            { Key: "CreatedBy", Value: "create-agent-script" }
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
    
    let attempts = 0;
    const maxAttempts = 40;
    
    while (attempts < maxAttempts) {
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

  private generateSetupScript(instanceDetails: any, keyPairName: string): void {
    const setupScript = `#!/bin/bash
# Setup script for Vargas JR agent: ${this.config.name}
# Generated automatically by create-agent.ts

set -e

echo "Setting up Vargas JR agent on ${instanceDetails.publicDns}"

# Connect to instance and run setup commands
ssh -i ~/.ssh/${keyPairName}.pem ubuntu@${instanceDetails.publicDns} << 'EOF'

# Update system
sudo apt update

# Install Python 3.12 and dependencies
sudo apt install -y python3.12 python3.12-venv python3-pip

# Set Python alternatives
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

# Install Poetry
curl -sSL https://install.python-poetry.org | python - -y --version 1.8.3
source ~/.profile

# Create .env file (you'll need to populate this manually)
cat > ~/.env << 'ENVEOF'
POSTGRES_URL=your_postgres_url_here
LOG_LEVEL=INFO
VELLUM_API_KEY=your_vellum_api_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_DEFAULT_REGION=us-east-1
# Add other Vargas Jr specific env vars here
ENVEOF

echo "✅ Basic setup complete. Please:"
echo "1. Update ~/.env with your actual credentials"
echo "2. Copy run_agent.sh to the instance"
echo "3. Make run_agent.sh executable: chmod u+x ~/run_agent.sh"
echo "4. Run the agent: ./run_agent.sh"

EOF
`;
    
    writeFileSync(`./scripts/setup-${this.config.name}.sh`, setupScript, { mode: 0o755 });
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/create-agent.ts <agent-name>");
    console.error("Example: npx tsx scripts/create-agent.ts my-agent");
    process.exit(1);
  }

  const agentName = args[0];
  
  if (!/^[a-zA-Z0-9-]+$/.test(agentName)) {
    console.error("Agent name must contain only letters, numbers, and hyphens");
    process.exit(1);
  }

  const creator = new VargasJRAgentCreator({ name: agentName });
  await creator.createAgent();
}

if (require.main === module) {
  main().catch(console.error);
}
