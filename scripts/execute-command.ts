#!/usr/bin/env npx tsx

import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { getSecret, findPRNumberByBranch } from './utils';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

interface CommandExecutionConfig {
  command: string;
  prNumber?: string;
  region?: string;
}

interface ExecutionResult {
  instanceId: string;
  name: string;
  success: boolean;
  output: string | null;
  error: string | null;
}

interface CommandResults {
  ssh: {
    success: boolean;
    results: ExecutionResult[];
    error?: string;
  };
  ssm: {
    success: boolean;
    results: ExecutionResult[];
    error?: string;
  };
}

class VargasJRCommandExecutor {
  private ec2: EC2Client;
  private ssm: SSMClient;
  private config: CommandExecutionConfig;

  constructor(config: CommandExecutionConfig) {
    this.config = {
      region: "us-east-1",
      ...config
    };
    this.ec2 = new EC2Client({ region: this.config.region });
    this.ssm = new SSMClient({ region: this.config.region });
  }

  async execute(): Promise<CommandResults> {
    console.log(`🚀 Executing command: ${this.config.command}`);
    
    const instances = await this.findInstances();
    if (instances.length === 0) {
      const error = "No target instances found";
      return {
        ssh: { success: false, results: [], error },
        ssm: { success: false, results: [], error }
      };
    }

    console.log(`📍 Found ${instances.length} instance(s) to target`);

    const [sshResults, ssmResults] = await Promise.all([
      this.executeSSHCommands(instances),
      this.executeSSMCommands(instances)
    ]);

    this.displayResults(sshResults, ssmResults);

    return {
      ssh: sshResults,
      ssm: ssmResults
    };
  }

  private async findInstances() {
    let filters;
    
    if (this.config.prNumber) {
      console.log(`🔍 Looking for PR ${this.config.prNumber} instance...`);
      filters = [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:PRNumber", Values: [this.config.prNumber] },
        { Name: "instance-state-name", Values: ["running"] }
      ];
    } else {
      console.log(`🔍 Looking for production instance...`);
      filters = [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "tag:Type", Values: ["main"] },
        { Name: "instance-state-name", Values: ["running"] }
      ];
    }

    const result = await this.ec2.send(new DescribeInstancesCommand({ Filters: filters }));
    const instances = result.Reservations?.flatMap((r) => r.Instances || []) || [];
    
    return instances
      .filter(instance => instance.InstanceId && instance.PublicDnsName && instance.KeyName)
      .map(instance => ({
        instanceId: instance.InstanceId!,
        publicDns: instance.PublicDnsName!,
        keyName: instance.KeyName!,
        name: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || 'unknown'
      }));
  }

  private async executeSSHCommands(instances: any[]): Promise<{ success: boolean; results: ExecutionResult[]; error?: string }> {
    console.log(`\n🔗 SSH: Executing command on ${instances.length} instance(s)...`);
    
    try {
      const keyMaterial = await this.getSSHKey();
      const results: ExecutionResult[] = [];

      for (const instance of instances) {
        console.log(`\n🔗 SSH: Connecting to ${instance.name} (${instance.instanceId})...`);
        
        let keyPath: string | null = null;
        try {
          keyPath = await this.writeKeyToTempFile(keyMaterial, instance.keyName);
          
          const sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=30 -o ConnectionAttempts=3 ubuntu@${instance.publicDns} "${this.config.command}"`;
          
          const result = execSync(sshCommand, {
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 300000 // 5 minutes
          });
          
          console.log(`✅ SSH: Command completed successfully on ${instance.name}`);
          if (result.trim()) {
            console.log(`📄 SSH Output:`);
            result.split('\n').forEach(line => {
              if (line.trim()) {
                console.log(`   ${line}`);
              }
            });
          } else {
            console.log(`   (no output)`);
          }
          
          results.push({
            instanceId: instance.instanceId,
            name: instance.name,
            success: true,
            output: result.trim(),
            error: null
          });
          
        } catch (error: any) {
          console.error(`❌ SSH: Error executing command on ${instance.name}: ${error.message}`);
          
          results.push({
            instanceId: instance.instanceId,
            name: instance.name,
            success: false,
            output: null,
            error: error.message
          });
        } finally {
          if (keyPath && existsSync(keyPath)) {
            unlinkSync(keyPath);
          }
        }
      }
      
      console.log(`\n🏁 SSH: Command execution completed`);
      return { success: true, results };
      
    } catch (error: any) {
      console.error(`❌ SSH: Failed to execute commands: ${error.message}`);
      return { success: false, results: [], error: error.message };
    }
  }

  private async executeSSMCommands(instances: any[]): Promise<{ success: boolean; results: ExecutionResult[]; error?: string }> {
    console.log(`\n📡 SSM: Executing command on ${instances.length} instance(s)...`);
    
    try {
      const results: ExecutionResult[] = [];

      for (const instance of instances) {
        console.log(`\n📡 SSM: Executing on ${instance.name} (${instance.instanceId})...`);
        
        try {
          const commandResult = await this.ssm.send(new SendCommandCommand({
            InstanceIds: [instance.instanceId],
            DocumentName: "AWS-RunShellScript",
            Parameters: {
              commands: [this.config.command],
            },
            TimeoutSeconds: 300,
          }));

          const commandId = commandResult.Command?.CommandId;
          if (!commandId) {
            throw new Error("Failed to get command ID from SSM");
          }

          console.log(`⏳ SSM: Waiting for command completion (ID: ${commandId})...`);

          let pollAttempts = 0;
          const maxPollAttempts = 60;
          
          while (pollAttempts < maxPollAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const outputResult = await this.ssm.send(new GetCommandInvocationCommand({
              CommandId: commandId,
              InstanceId: instance.instanceId,
            }));

            if (outputResult.Status === "Success") {
              console.log(`✅ SSM: Command completed successfully on ${instance.name}`);
              const output = outputResult.StandardOutputContent || "";
              if (output.trim()) {
                console.log(`📄 SSM Output:`);
                output.split('\n').forEach(line => {
                  if (line.trim()) {
                    console.log(`   ${line}`);
                  }
                });
              } else {
                console.log(`   (no output)`);
              }
              
              results.push({
                instanceId: instance.instanceId,
                name: instance.name,
                success: true,
                output: output.trim(),
                error: null
              });
              break;
            } else if (outputResult.Status === "Failed") {
              const errorDetails = outputResult.StandardErrorContent || "No error details available";
              const outputDetails = outputResult.StandardOutputContent || "No output";
              console.log(`❌ SSM: Command failed on ${instance.name}`);
              console.log(`📄 Error: ${errorDetails}`);
              if (outputDetails.trim()) {
                console.log(`📄 Output: ${outputDetails}`);
              }
              
              results.push({
                instanceId: instance.instanceId,
                name: instance.name,
                success: false,
                output: outputDetails.trim(),
                error: errorDetails
              });
              break;
            } else if (outputResult.Status === "Cancelled" || outputResult.Status === "TimedOut") {
              console.log(`⚠️ SSM: Command ${outputResult.Status.toLowerCase()} on ${instance.name}`);
              
              results.push({
                instanceId: instance.instanceId,
                name: instance.name,
                success: false,
                output: null,
                error: `Command ${outputResult.Status.toLowerCase()}`
              });
              break;
            }
            
            pollAttempts++;
            if (pollAttempts < maxPollAttempts) {
              console.log(`⏳ SSM: Still waiting... (${pollAttempts}/${maxPollAttempts})`);
            }
          }
          
          if (pollAttempts >= maxPollAttempts) {
            console.log(`⚠️ SSM: Command timed out after 5 minutes on ${instance.name}`);
            results.push({
              instanceId: instance.instanceId,
              name: instance.name,
              success: false,
              output: null,
              error: "Command timed out after 5 minutes"
            });
          }
        } catch (error: any) {
          console.error(`❌ SSM: Error executing command on ${instance.name}: ${error.message}`);
          results.push({
            instanceId: instance.instanceId,
            name: instance.name,
            success: false,
            output: null,
            error: error.message
          });
        }
      }
      
      console.log(`\n🏁 SSM: Command execution completed`);
      return { success: true, results };
      
    } catch (error: any) {
      console.error(`❌ SSM: Failed to execute commands: ${error.message}`);
      return { success: false, results: [], error: error.message };
    }
  }

  private async getSSHKey(): Promise<string> {
    let secretName;
    
    if (this.config.prNumber) {
      secretName = `vargasjr-pr-${this.config.prNumber}-pr-${this.config.prNumber}-key-pem`;
    } else {
      secretName = `vargasjr-prod-prod-key-pem`;
    }

    console.log(`🔑 Retrieving SSH key from secret: ${secretName}`);
    
    try {
      return await getSecret(secretName, this.config.region);
    } catch (error: any) {
      if (this.config.prNumber && error.message?.includes('Secret not found')) {
        const fallbackSecretName = `vargasjr-pr-${this.config.prNumber}-key-pem`;
        console.log(`Primary secret not found, trying fallback: ${fallbackSecretName}`);
        return await getSecret(fallbackSecretName, this.config.region);
      }
      throw error;
    }
  }

  private async writeKeyToTempFile(keyMaterial: string, keyName: string): Promise<string> {
    const keyPath = `${tmpdir()}/vargasjr-ssh-${keyName}-${Date.now()}.pem`;
    writeFileSync(keyPath, keyMaterial, { mode: 0o600 });
    console.log(`✅ SSH key written to temporary file: ${keyPath}`);
    return keyPath;
  }

  private displayResults(sshResults: any, ssmResults: any): void {
    console.log(`\n📊 EXECUTION SUMMARY`);
    console.log(`==================`);
    
    console.log(`\n🔗 SSH Results:`);
    if (sshResults.success) {
      const successCount = sshResults.results.filter((r: any) => r.success).length;
      const failCount = sshResults.results.length - successCount;
      console.log(`   ✅ ${successCount} successful, ❌ ${failCount} failed`);
      
      sshResults.results.forEach((result: any) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.name} (${result.instanceId})`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    } else {
      console.log(`   ❌ Failed: ${sshResults.error}`);
    }
    
    console.log(`\n📡 SSM Results:`);
    if (ssmResults.success) {
      const successCount = ssmResults.results.filter((r: any) => r.success).length;
      const failCount = ssmResults.results.length - successCount;
      console.log(`   ✅ ${successCount} successful, ❌ ${failCount} failed`);
      
      ssmResults.results.forEach((result: any) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.name} (${result.instanceId})`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    } else {
      console.log(`   ❌ Failed: ${ssmResults.error}`);
    }
  }
}

async function main() {
  const command = process.env.COMMAND;
  if (!command) {
    console.error("❌ COMMAND environment variable is required");
    process.exit(1);
  }

  let prNumber: string | undefined;
  const githubRef = process.env.GITHUB_REF;
  if (githubRef) {
    const branchMatch = githubRef.match(/refs\/heads\/(.+)/);
    if (branchMatch) {
      const branchName = branchMatch[1];
      console.log(`🔍 Detected branch: ${branchName}`);
      prNumber = await findPRNumberByBranch(branchName) || undefined;
    }
  }

  const executor = new VargasJRCommandExecutor({ command, prNumber });
  
  try {
    const results = await executor.execute();
    
    console.log(`::set-output name=ssh_output::${JSON.stringify(results.ssh)}`);
    console.log(`::set-output name=ssm_output::${JSON.stringify(results.ssm)}`);
    
    if (!results.ssh.success && !results.ssm.success) {
      console.error("❌ Both SSH and SSM execution failed");
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(`❌ Command execution failed: ${error.message}`);
    console.log(`::set-output name=ssh_output::${JSON.stringify({ success: false, results: [], error: error.message })}`);
    console.log(`::set-output name=ssm_output::${JSON.stringify({ success: false, results: [], error: error.message })}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
