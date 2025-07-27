import { EC2 } from "@aws-sdk/client-ec2";
import { SSM } from "@aws-sdk/client-ssm";
import { IAMClient, GetInstanceProfileCommand } from "@aws-sdk/client-iam";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import { readFileSync } from "fs";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";

export interface EC2Instance {
  InstanceId?: string;
  State?: { Name?: string };
  Tags?: Array<{ Key?: string; Value?: string }>;
  ImageId?: string;
}

export async function findInstancesByFilters(
  ec2: EC2,
  filters: Array<{ Name: string; Values: string[] }>
): Promise<EC2Instance[]> {
  const result = await ec2.describeInstances({ Filters: filters });
  return result.Reservations?.flatMap((r) => r.Instances || []) || [];
}

export async function terminateInstances(
  ec2: EC2,
  instanceIds: string[]
): Promise<void> {
  if (instanceIds.length === 0) return;

  await ec2.terminateInstances({ InstanceIds: instanceIds });
}

export async function waitForInstancesTerminated(
  ec2: EC2,
  instanceIds: string[],
  maxAttempts: number = 30
): Promise<void> {
  if (instanceIds.length === 0) return;

  console.log("Waiting for instances to be terminated...");

  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const result = await ec2.describeInstances({ InstanceIds: instanceIds });
      const instances =
        result.Reservations?.flatMap((r) => r.Instances || []) || [];

      const stillExists = instances.some(
        (instance) =>
          instance.State?.Name !== "terminated" &&
          instance.State?.Name !== "shutting-down"
      );

      if (!stillExists) {
        console.log("✅ All instances have been terminated");
        return;
      }

      attempts++;
      console.log(
        `Instances still terminating... (${attempts}/${maxAttempts})`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error: any) {
      if (error.name === "InvalidInstanceID.NotFound") {
        console.log("✅ All instances have been terminated");
        return;
      }
      throw error;
    }
  }

  throw new Error("Instances failed to terminate within timeout");
}

export async function deleteKeyPair(
  ec2: EC2,
  keyPairName: string
): Promise<void> {
  try {
    console.log(`Deleting key pair: ${keyPairName}`);

    await ec2.deleteKeyPair({ KeyName: keyPairName });

    console.log(`✅ Key pair ${keyPairName} deleted`);
  } catch (error: any) {
    if (error.name === "InvalidKeyPair.NotFound") {
      console.log(`⚠️  Key pair ${keyPairName} not found, skipping deletion`);
    } else {
      throw error;
    }
  }
}

export async function findOrCreateSecurityGroup(
  ec2: EC2,
  groupName: string,
  description: string
): Promise<string> {
  try {
    const result = await ec2.describeSecurityGroups({
      Filters: [{ Name: "group-name", Values: [groupName] }],
    });

    if (result.SecurityGroups && result.SecurityGroups.length > 0) {
      const groupId = result.SecurityGroups[0].GroupId;
      console.log(`✅ Found existing security group: ${groupId}`);
      return groupId!;
    }

    console.log(`Creating security group: ${groupName}`);
    const createResult = await ec2.createSecurityGroup({
      GroupName: groupName,
      Description: description,
    });

    const groupId = createResult.GroupId!;
    console.log(`✅ Created security group: ${groupId}`);

    await ec2.authorizeSecurityGroupIngress({
      GroupId: groupId,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 22,
          ToPort: 22,
          IpRanges: [
            { CidrIp: "0.0.0.0/0", Description: "SSH access from anywhere" },
          ],
        },
      ],
    });

    console.log(`✅ Added SSH rule to security group: ${groupId}`);
    return groupId;
  } catch (error: any) {
    console.error(`Failed to create/find security group: ${error}`);
    throw error;
  }
}

export async function createSecret(
  secretName: string,
  secretValue: string,
  region: string = "us-east-1"
): Promise<void> {
  const secretsManager = new SecretsManager({ region });

  try {
    console.log(`Creating secret: ${secretName}`);

    await secretsManager.createSecret({
      Name: secretName,
      SecretString: secretValue,
      Description: `SSH key for VargasJR agent: ${secretName}`,
    });

    console.log(`✅ Secret created: ${secretName}`);
  } catch (error: any) {
    if (error.name === "ResourceExistsException") {
      console.log(`⚠️  Secret ${secretName} already exists, updating...`);

      try {
        await secretsManager.updateSecret({
          SecretId: secretName,
          SecretString: secretValue,
        });

        console.log(`✅ Secret updated: ${secretName}`);
      } catch (updateError: any) {
        if (
          updateError.name === "AccessDeniedException" ||
          updateError.name === "UnauthorizedOperation"
        ) {
          console.warn(
            `⚠️  Insufficient permissions to update secret ${secretName}: ${updateError.message}`
          );
          return;
        }
        throw updateError;
      }
    } else if (
      error.name === "AccessDeniedException" ||
      error.name === "UnauthorizedOperation"
    ) {
      console.warn(
        `⚠️  Insufficient permissions to create secret ${secretName}: ${error.message}`
      );
      return;
    } else {
      throw error;
    }
  }
}

export async function getSecret(
  secretName: string,
  region: string = "us-east-1"
): Promise<string> {
  const secretsManager = new SecretsManager({ region });

  try {
    const result = await secretsManager.getSecretValue({
      SecretId: secretName,
    });

    if (!result.SecretString) {
      throw new Error("No secret string returned from Secrets Manager");
    }

    return result.SecretString;
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      throw new Error(`Secret not found: ${secretName}`);
    } else if (
      error.name === "AccessDeniedException" ||
      error.name === "UnauthorizedOperation"
    ) {
      console.warn(
        `⚠️  Insufficient permissions to retrieve secret ${secretName}: ${error.message}`
      );
      throw new Error(`Access denied for secret: ${secretName}`);
    }
    throw error;
  }
}

export async function deleteSecret(
  secretName: string,
  region: string = "us-east-1"
): Promise<void> {
  const secretsManager = new SecretsManager({ region });

  try {
    console.log(`Deleting secret: ${secretName}`);

    await secretsManager.deleteSecret({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: true,
    });

    console.log(`✅ Secret deleted: ${secretName}`);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.log(`⚠️  Secret ${secretName} not found, skipping deletion`);
    } else if (
      error.name === "AccessDeniedException" ||
      error.name === "UnauthorizedOperation"
    ) {
      console.warn(
        `⚠️  Insufficient permissions to delete secret ${secretName}: ${error.message}`
      );
      return;
    } else {
      throw error;
    }
  }
}

export async function getNeonPreviewDatabaseUrl(
  branchName?: string
): Promise<string> {
  const neonApiKey = process.env.NEON_API_KEY;
  const resolvedBranchName =
    branchName || process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME;
  const projectId = "fancy-sky-34733112";

  if (!neonApiKey) {
    throw new Error(
      "NEON_API_KEY environment variable is required for preview mode"
    );
  }

  if (!resolvedBranchName) {
    throw new Error(
      "Branch name must be provided or GITHUB_HEAD_REF/BRANCH_NAME environment variable must be set"
    );
  }

  const fullBranchName = `preview/${resolvedBranchName}`;
  console.log(`🔍 Fetching database URL for branch: ${fullBranchName}`);

  try {
    const branchResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
      {
        headers: {
          Authorization: `Bearer ${neonApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!branchResponse.ok) {
      throw new Error(`Failed to fetch branches: ${branchResponse.statusText}`);
    }

    const branchData = await branchResponse.json();
    const branch = branchData.branches?.find(
      (b: any) => b.name === fullBranchName
    );

    if (!branch) {
      throw new Error(`Branch '${fullBranchName}' not found`);
    }

    const branchId = branch.id;
    console.log(`✅ Found branch ID: ${branchId}`);

    const connectionResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=verceldb&role_name=default`,
      {
        headers: {
          Authorization: `Bearer ${neonApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!connectionResponse.ok) {
      throw new Error(
        `Failed to fetch connection URI: ${connectionResponse.statusText}`
      );
    }

    const connectionData = await connectionResponse.json();
    const postgresUrl = connectionData.uri;

    if (!postgresUrl) {
      throw new Error("No connection URI found in response");
    }

    console.log(`✅ Retrieved database URL for preview branch`);
    return postgresUrl;
  } catch (error) {
    throw new Error(`Failed to get Neon database URL: ${error}`);
  }
}

export interface HealthCheckResult {
  instanceId: string;
  status: "healthy" | "unhealthy" | "offline";
  error?: string;
  diagnostics?: {
    ssm?: {
      registered?: boolean;
      pingStatus?: string;
      lastPingDateTime?: Date;
      timeSinceLastPing?: string;
      platformType?: string;
      agentVersion?: string;
      associationStatus?: string;
      lastAssociationExecutionDate?: Date;
      troubleshooting?: string[];
    };
    healthcheck?: {
      environmentVariables?: {
        critical?: Record<string, boolean>;
        optional?: Record<string, boolean>;
      };
      processes?: string;
      memory?: string;
      fatalErrors?: boolean;
    };
    troubleshooting?: string[];
  };
}

export interface HealthCheckOptions {
  environment?: "preview" | "production";
  version?: string;
  prNumber?: string;
}

export interface SSMReadinessResult {
  ready: boolean;
  error?: string;
  diagnostics?: {
    registered: boolean;
    pingStatus?: string;
    lastPingDateTime?: Date;
    timeSinceLastPing?: string;
    platformType?: string;
    agentVersion?: string;
    associationStatus?: string;
    lastAssociationExecutionDate?: Date;
    troubleshooting?: string[];
  };
}

export async function validateSSMReadiness(
  instanceId: string,
  region: string = "us-east-1"
): Promise<SSMReadinessResult> {
  console.log(`[SSM Validation] Starting validation for instance ${instanceId} in region ${region}`);
  const validationStartTime = Date.now();
  
  const ec2 = new EC2({ region });
  const ssm = new SSM({ region });

  try {
    console.log(`[SSM Validation] Checking EC2 instance state...`);
    const instanceResult = await ec2.describeInstances({
      InstanceIds: [instanceId],
    });
    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];

    if (!instance) {
      console.error(`[SSM Validation] Instance ${instanceId} not found`);
      return {
        ready: false,
        error: "Instance not found",
      };
    }

    const instanceState = instance.State?.Name;
    console.log(`[SSM Validation] Instance state: ${instanceState}`);
    
    if (instanceState !== "running") {
      console.error(`[SSM Validation] Instance is ${instanceState}, must be running for SSM`);
      return {
        ready: false,
        error: `Instance is ${instanceState}, must be running for SSM`,
      };
    }

    console.log(`[SSM Validation] Checking SSM registration...`);
    const ssmInstances = await ssm.describeInstanceInformation({
      Filters: [{ Key: "InstanceIds", Values: [instanceId] }],
    });

    if (!ssmInstances.InstanceInformationList?.length) {
      console.error(`[SSM Validation] Instance ${instanceId} not registered with Systems Manager`);
      return {
        ready: false,
        error: "Instance not registered with Systems Manager",
        diagnostics: {
          registered: false,
          troubleshooting: [
            "Verify SSM Agent is installed and running",
            "Check IAM instance profile has AmazonSSMManagedInstanceCore policy", 
            "Verify VPC endpoints or outbound HTTPS (443) connectivity",
            "Restart SSM Agent: sudo systemctl restart amazon-ssm-agent"
          ]
        }
      };
    }

    const ssmInstance = ssmInstances.InstanceInformationList[0];
    const pingStatus = ssmInstance.PingStatus;
    const lastPingDateTime = ssmInstance.LastPingDateTime;
    const platformType = ssmInstance.PlatformType;
    const agentVersion = ssmInstance.AgentVersion;
    const lastAssociationExecutionDate = ssmInstance.LastAssociationExecutionDate;
    const associationStatus = ssmInstance.AssociationStatus;
    
    console.log(`[SSM Validation] SSM Instance Details:`);
    console.log(`  - Ping Status: ${pingStatus}`);
    console.log(`  - Last Ping: ${lastPingDateTime}`);
    console.log(`  - Platform: ${platformType}`);
    console.log(`  - Agent Version: ${agentVersion}`);
    console.log(`  - Association Status: ${associationStatus}`);
    console.log(`  - Last Association Execution: ${lastAssociationExecutionDate}`);

    if (pingStatus !== "Online") {
      const validationDuration = Date.now() - validationStartTime;
      const timeSinceLastPing = lastPingDateTime ? 
        Math.floor((Date.now() - new Date(lastPingDateTime).getTime()) / 1000 / 60) : null;
      
      console.error(`[SSM Validation] SSM agent ping status is ${pingStatus}, must be Online`);
      console.error(`[SSM Validation] Last successful ping was at: ${lastPingDateTime}`);
      console.error(`[SSM Validation] Validation failed after ${validationDuration}ms`);
      
      const troubleshootingSteps = [
        "Check if SSM Agent is running: sudo systemctl status amazon-ssm-agent",
        "Restart SSM Agent: sudo systemctl restart amazon-ssm-agent", 
        "Verify IAM instance profile permissions (AmazonSSMManagedInstanceCore)",
        "Check VPC security groups allow outbound HTTPS (443)",
        "Verify Systems Manager VPC endpoints if using private subnets"
      ];

      if (timeSinceLastPing && timeSinceLastPing > 30) {
        troubleshootingSteps.unshift("Instance has been offline for over 30 minutes - may need manual intervention");
      }
      
      return {
        ready: false,
        error: `SSM agent is ${pingStatus}, must be Online`,
        diagnostics: {
          registered: true,
          pingStatus,
          lastPingDateTime,
          timeSinceLastPing: timeSinceLastPing ? `${timeSinceLastPing} minutes ago` : 'Unknown',
          platformType,
          agentVersion,
          associationStatus,
          lastAssociationExecutionDate,
          troubleshooting: troubleshootingSteps
        }
      };
    }

    const validationDuration = Date.now() - validationStartTime;
    console.log(`[SSM Validation] Validation successful after ${validationDuration}ms`);
    return { 
      ready: true,
      diagnostics: {
        registered: true,
        pingStatus,
        lastPingDateTime,
        platformType,
        agentVersion,
        associationStatus,
        lastAssociationExecutionDate
      }
    };
    
  } catch (error: any) {
    const validationDuration = Date.now() - validationStartTime;
    console.error(`[SSM Validation] Validation failed after ${validationDuration}ms`);
    console.error(`[SSM Validation] Error:`, error);
    
    if (error.name === "InvalidInstanceID.NotFound") {
      console.error(`[SSM Validation] AWS returned InvalidInstanceID.NotFound for ${instanceId}`);
      return { ready: false, error: "Instance not found" };
    }
    
    const errorMessage = error.message || "Unknown validation error";
    console.error(`[SSM Validation] Unexpected error: ${errorMessage}`);
    return { ready: false, error: errorMessage };
  }
}

export async function checkInstanceHealth(
  instanceId: string,
  region: string = "us-east-1"
): Promise<HealthCheckResult> {
  const ssm = new SSM({ region });

  try {
    const ssmValidationStartTime = Date.now();
    const ssmValidation = await validateSSMReadiness(instanceId, region);
    const ssmValidationDuration = Date.now() - ssmValidationStartTime;
    console.log(
      `[Health Check] SSM Validation - Duration: ${ssmValidationDuration}ms, Ready: ${ssmValidation.ready}`
    );

    if (!ssmValidation.ready) {
      return {
        instanceId,
        status: "offline",
        error: `Health check failed: ${ssmValidation.error}`,
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          troubleshooting: ssmValidation.diagnostics?.troubleshooting || []
        }
      };
    }

    try {
      const sendCommandStartTime = Date.now();
      const directoryName = `vargasjr_dev_agent-*`;

      const ssmOperation = async () => {
        const commandResult = await ssm.sendCommand({
          InstanceIds: [instanceId],
          DocumentName: "AWS-RunShellScript",
          Parameters: {
            commands: [`cd /home/ubuntu/${directoryName} && timeout 5s npm run healthcheck`],
          },
          TimeoutSeconds: 30,
        });
        const sendCommandDuration = Date.now() - sendCommandStartTime;
        const commandId = commandResult.Command?.CommandId;
        console.log(`[Health Check] SSM Send Command - Duration: ${sendCommandDuration}ms, CommandId: ${commandId}`);
        if (!commandId) {
          throw new Error("Failed to get command ID from SSM");
        }

        const pollingStartTime = Date.now();
        let attempts = 0;
        const maxAttempts = 20;
        let commandOutput = "";

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            const outputResult = await ssm.getCommandInvocation({
              CommandId: commandId,
              InstanceId: instanceId,
            });

            if (outputResult.Status === "Success") {
              commandOutput = outputResult.StandardOutputContent || "";
              break;
            } else if (outputResult.Status === "Failed") {
              const errorDetails =
                outputResult.StandardErrorContent || "No error details available";
              const outputDetails =
                outputResult.StandardOutputContent || "No output";
              
              const exitCode = outputResult.ResponseCode || 1;
              const isFatalError = exitCode === 2;
              
              if (isFatalError) {
                throw new Error(
                  `Fatal error detected (exit code ${exitCode}): ${errorDetails}\nCommand output: ${outputDetails}`
                );
              }
              
              throw new Error(
                `SSM command failed (exit code ${exitCode}): ${errorDetails}\nCommand output: ${outputDetails}`
              );
            }
          } catch (outputError) {
            if (attempts === maxAttempts - 1) {
              throw outputError;
            }
            console.error(
              `[Health Check] Attempt ${attempts + 1}/${maxAttempts} Error: ${
                outputError instanceof Error
                  ? outputError.message
                  : String(outputError)
              }`
            );
          }

          attempts++;
        }

        const pollingDuration = Date.now() - pollingStartTime;
        console.log(
          `[Health Check] SSM Polling Loop - Total duration: ${pollingDuration}ms, Attempts: ${
            attempts + 1
          }/${maxAttempts}, Final Status: ${commandOutput ? 'Success' : 'Timeout'}`
        );

        if (attempts >= maxAttempts) {
          throw new Error("SSM command timed out");
        }

        return commandOutput;
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("SSM health check timed out after 15 seconds"));
        }, 15000);
      });

      const commandOutput = await Promise.race([ssmOperation(), timeoutPromise]);

      const hasAgentSession =
        commandOutput.includes("agent-") || commandOutput.includes("\tagent\t");

      const diagnosticInfo = parseHealthcheckOutput(commandOutput);
      const troubleshootingSteps = generateTroubleshootingSteps(commandOutput, hasAgentSession);

      return {
        instanceId,
        status: hasAgentSession ? "healthy" : "unhealthy",
        error: hasAgentSession ? undefined : generateDetailedErrorMessage(commandOutput),
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          healthcheck: diagnosticInfo,
          troubleshooting: troubleshootingSteps
        }
      };
    } catch (ssmError) {
      const errorMessage =
        ssmError instanceof Error ? ssmError.message : "SSM command failed";

      if (
        errorMessage.includes("InvalidInstanceId.NotFound") ||
        errorMessage.includes("not registered")
      ) {
        return {
          instanceId,
          status: "offline",
          error: "Instance not managed by Systems Manager"
        };
      }

      return {
        instanceId,
        status: "offline",
        error: `SSM Command Failed: ${errorMessage}`,
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          troubleshooting: [
            ...ssmValidation.diagnostics?.troubleshooting || [],
            'Check SSM agent connectivity and permissions',
            'Verify instance is running and accessible',
            'Review CloudWatch logs for SSM command execution'
          ]
        }
      };
    }
  } catch (error) {
    return {
      instanceId,
      status: "offline",
      error:
        error instanceof Error
          ? `Check Instance Failed: ${error.message}`
          : "Health check failed"
    };
  }
}

function parseHealthcheckOutput(output: string): any {
  const diagnostics: any = {};
  
  if (output.includes('Environment Variables Check')) {
    const envSection = output.split('--- Environment Variables Check ---')[1]?.split('---')[0];
    if (envSection) {
      diagnostics.environmentVariables = {
        critical: extractEnvVarStatus(envSection, ['AGENT_ENVIRONMENT', 'DATABASE_URL', 'VELLUM_API_KEY']),
        optional: extractEnvVarStatus(envSection, ['PR_NUMBER', 'GITHUB_TOKEN'])
      };
    }
  }
  
  if (output.includes('Process Information')) {
    diagnostics.processes = output.includes('Agent-related processes found') ? 'found' : 'none';
  }
  
  if (output.includes('Memory usage:')) {
    const memoryMatch = output.match(/Memory usage:\s*\n([^\n]+)/);
    if (memoryMatch) {
      diagnostics.memory = memoryMatch[1].trim();
    }
  }
  
  if (output.includes('FATAL ERROR') || output.includes('💀')) {
    diagnostics.fatalErrors = true;
  }
  
  return diagnostics;
}

function extractEnvVarStatus(section: string, varNames: string[]): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  varNames.forEach(varName => {
    status[varName] = section.includes(`${varName}: ✓ Set`);
  });
  return status;
}

function generateDetailedErrorMessage(output: string): string {
  if (output.includes('💀 FATAL ERROR')) {
    return 'Agent has fatal errors - check logs for critical issues';
  }
  
  if (output.includes('No agent-related processes found')) {
    return 'Agent process not running - may have crashed or failed to start';
  }
  
  if (output.includes('No screen sessions found')) {
    return 'No screen sessions found - agent may not have started properly';
  }
  
  if (output.includes('Missing') && output.includes('environment variables')) {
    return 'Missing critical environment variables - check agent configuration';
  }
  
  return 'Agent not running - check screen sessions and process status';
}

function generateTroubleshootingSteps(output: string, hasAgentSession: boolean): string[] {
  const steps: string[] = [];
  
  if (output.includes('💀 FATAL ERROR')) {
    steps.push('Check error.log and agent.log for critical errors');
    steps.push('Verify all environment variables are properly set');
    steps.push('Check database connectivity');
    steps.push('Restart the agent process');
  } else if (!hasAgentSession) {
    steps.push('Check if agent screen session exists: screen -ls');
    steps.push('Restart agent: cd /home/ubuntu/vargasjr_dev_agent-* && npm run agent:start');
    steps.push('Check agent logs: tail -f agent.log error.log');
    steps.push('Verify environment variables are set');
  }
  
  if (output.includes('Missing') && output.includes('environment variables')) {
    steps.unshift('Set missing environment variables in .env file');
  }
  
  if (output.includes('No agent-related processes found')) {
    steps.push('Check system resources: free -h && df -h');
    steps.push('Verify node_modules are installed: npm install');
  }
  
  return steps;
}

export async function findOrCreateSSMInstanceProfile(): Promise<string> {
  const iam = new IAMClient({ region: "us-east-1" });
  const instanceProfileName = "VargasJR-SSM-InstanceProfile";

  try {
    await iam.send(
      new GetInstanceProfileCommand({
        InstanceProfileName: instanceProfileName,
      })
    );
    console.log(`✅ Using existing instance profile: ${instanceProfileName}`);
    return instanceProfileName;
  } catch (error: any) {
    if (error.name !== "NoSuchEntity") {
      throw error;
    }
    throw new Error(
      `IAM instance profile '${instanceProfileName}' does not exist. Please create it manually or use Default Host Management Configuration.`
    );
  }
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        break;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export function isRetryableError(error: any): boolean {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  if (error.message && error.message.includes('GitHub API error')) {
    const statusMatch = error.message.match(/GitHub API error: (\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return status >= 500 || status === 429;
    }
    return true;
  }
  
  return false;
}

export async function postGitHubComment(
  content: string,
  userAgent: string,
  successMessage: string = "Posted comment to PR"
): Promise<void> {
  const githubRepo = "dvargas92495/vargasjr-dev";
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (
    !githubRepo ||
    eventName !== "pull_request" ||
    !eventPath
  ) {
    console.log(
      "Not in PR context or missing GitHub environment variables, skipping comment"
    );
    return;
  }

  try {
    const eventData = JSON.parse(readFileSync(eventPath, "utf8"));
    const prNumber = eventData.number;

    if (!prNumber) {
      console.log("No PR number found in event data");
      return;
    }

    await retryWithBackoff(async () => {
      const headers = await getGitHubAuthHeaders();
      
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "User-Agent": userAgent,
          },
          body: JSON.stringify({
            body: content,
          }),
        }
      );

      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        } else {
          throw new Error(`GitHub API client error: ${response.status} ${response.statusText}`);
        }
      }

      return response;
    });

    console.log(`✅ ${successMessage}`);
  } catch (error) {
    console.error("Failed to post GitHub comment after retries:", error);
  }
}

export abstract class OneTimeMigrationRunner {
  protected isPreviewMode: boolean;
  protected abstract migrationName: string;
  protected abstract userAgent: string;

  constructor(isPreviewMode: boolean = false) {
    this.isPreviewMode = isPreviewMode;
  }

  async run(): Promise<void> {
    const action = this.isPreviewMode ? "Previewing" : "Running";
    console.log(`🔍 ${action} ${this.migrationName}...`);

    try {
      await this.runMigration();

      const successAction = this.isPreviewMode ? "preview" : "execution";
      console.log(
        `✅ ${this.migrationName} ${successAction} completed successfully!`
      );
    } catch (error) {
      const failAction = this.isPreviewMode ? "preview" : "run";
      console.error(
        `❌ Failed to ${failAction} ${this.migrationName}: ${error}`
      );
      process.exit(1);
    }
  }

  protected abstract runMigration(): Promise<void>;

  protected async postComment(
    content: string,
    successMessage?: string
  ): Promise<void> {
    await postGitHubComment(
      content,
      this.userAgent,
      successMessage || `Posted ${this.migrationName} comment to PR`
    );
  }

  protected logSection(title: string): void {
    console.log(`=== ${title} ===`);
  }

  protected logSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  protected logWarning(message: string): void {
    console.log(`⚠️ ${message}`);
  }

  protected logError(message: string): void {
    console.error(`❌ ${message}`);
  }
}
