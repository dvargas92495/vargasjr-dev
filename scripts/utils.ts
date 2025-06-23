import { EC2 } from "@aws-sdk/client-ec2";
import { SSM } from "@aws-sdk/client-ssm";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import { IAM } from "@aws-sdk/client-iam";
import { readFileSync } from "fs";

export interface EC2Instance {
  InstanceId?: string;
  State?: { Name?: string };
  Tags?: Array<{ Key?: string; Value?: string }>;
  ImageId?: string;
}

export async function findInstancesByFilters(ec2: EC2, filters: Array<{ Name: string; Values: string[] }>): Promise<EC2Instance[]> {
  const result = await ec2.describeInstances({ Filters: filters });
  return result.Reservations?.flatMap(r => r.Instances || []) || [];
}

export async function terminateInstances(ec2: EC2, instanceIds: string[]): Promise<void> {
  if (instanceIds.length === 0) return;
  
  await ec2.terminateInstances({ InstanceIds: instanceIds });
}

export async function waitForInstancesTerminated(ec2: EC2, instanceIds: string[], maxAttempts: number = 30): Promise<void> {
  if (instanceIds.length === 0) return;

  console.log("Waiting for instances to be terminated...");
  
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const result = await ec2.describeInstances({ InstanceIds: instanceIds });
      const instances = result.Reservations?.flatMap(r => r.Instances || []) || [];
      
      const stillExists = instances.some(instance => 
        instance.State?.Name !== "terminated" && instance.State?.Name !== "shutting-down"
      );
      
      if (!stillExists) {
        console.log("✅ All instances have been terminated");
        return;
      }
      
      attempts++;
      console.log(`Instances still terminating... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
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

export async function deleteKeyPair(ec2: EC2, keyPairName: string): Promise<void> {
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

export async function findOrCreateSecurityGroup(ec2: EC2, groupName: string, description: string): Promise<string> {
  try {
    const result = await ec2.describeSecurityGroups({
      Filters: [
        { Name: "group-name", Values: [groupName] }
      ]
    });
    
    if (result.SecurityGroups && result.SecurityGroups.length > 0) {
      const groupId = result.SecurityGroups[0].GroupId;
      console.log(`✅ Found existing security group: ${groupId}`);
      return groupId!;
    }
    
    console.log(`Creating security group: ${groupName}`);
    const createResult = await ec2.createSecurityGroup({
      GroupName: groupName,
      Description: description
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
          IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "SSH access from anywhere" }]
        }
      ]
    });
    
    console.log(`✅ Added SSH rule to security group: ${groupId}`);
    return groupId;
    
  } catch (error: any) {
    console.error(`Failed to create/find security group: ${error}`);
    throw error;
  }
}

export async function createSecret(secretName: string, secretValue: string, region: string = "us-east-1"): Promise<void> {
  const secretsManager = new SecretsManager({ region });
  
  try {
    console.log(`Creating secret: ${secretName}`);
    
    await secretsManager.createSecret({
      Name: secretName,
      SecretString: secretValue,
      Description: `SSH key for VargasJR agent: ${secretName}`
    });
    
    console.log(`✅ Secret created: ${secretName}`);
  } catch (error: any) {
    if (error.name === "ResourceExistsException") {
      console.log(`⚠️  Secret ${secretName} already exists, updating...`);
      
      try {
        await secretsManager.updateSecret({
          SecretId: secretName,
          SecretString: secretValue
        });
        
        console.log(`✅ Secret updated: ${secretName}`);
      } catch (updateError: any) {
        if (updateError.name === "AccessDeniedException" || updateError.name === "UnauthorizedOperation") {
          console.warn(`⚠️  Insufficient permissions to update secret ${secretName}: ${updateError.message}`);
          return;
        }
        throw updateError;
      }
    } else if (error.name === "AccessDeniedException" || error.name === "UnauthorizedOperation") {
      console.warn(`⚠️  Insufficient permissions to create secret ${secretName}: ${error.message}`);
      return;
    } else {
      throw error;
    }
  }
}

export async function getSecret(secretName: string, region: string = "us-east-1"): Promise<string> {
  const secretsManager = new SecretsManager({ region });
  
  try {
    const result = await secretsManager.getSecretValue({
      SecretId: secretName
    });
    
    if (!result.SecretString) {
      throw new Error("No secret string returned from Secrets Manager");
    }
    
    return result.SecretString;
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      throw new Error(`Secret not found: ${secretName}`);
    } else if (error.name === "AccessDeniedException" || error.name === "UnauthorizedOperation") {
      console.warn(`⚠️  Insufficient permissions to retrieve secret ${secretName}: ${error.message}`);
      throw new Error(`Access denied for secret: ${secretName}`);
    }
    throw error;
  }
}

export async function deleteSecret(secretName: string, region: string = "us-east-1"): Promise<void> {
  const secretsManager = new SecretsManager({ region });
  
  try {
    console.log(`Deleting secret: ${secretName}`);
    
    await secretsManager.deleteSecret({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: true
    });
    
    console.log(`✅ Secret deleted: ${secretName}`);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.log(`⚠️  Secret ${secretName} not found, skipping deletion`);
    } else if (error.name === "AccessDeniedException" || error.name === "UnauthorizedOperation") {
      console.warn(`⚠️  Insufficient permissions to delete secret ${secretName}: ${error.message}`);
      return;
    } else {
      throw error;
    }
  }
}

export async function getNeonPreviewDatabaseUrl(branchName?: string): Promise<string> {
  const neonApiKey = process.env.NEON_API_KEY;
  const resolvedBranchName = branchName || process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME;
  const projectId = "fancy-sky-34733112";
  
  if (!neonApiKey) {
    throw new Error("NEON_API_KEY environment variable is required for preview mode");
  }
  
  if (!resolvedBranchName) {
    throw new Error("Branch name must be provided or GITHUB_HEAD_REF/BRANCH_NAME environment variable must be set");
  }
  
  const fullBranchName = `preview/${resolvedBranchName}`;
  console.log(`🔍 Fetching database URL for branch: ${fullBranchName}`);
  
  try {
    const branchResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches`, {
      headers: {
        "Authorization": `Bearer ${neonApiKey}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!branchResponse.ok) {
      throw new Error(`Failed to fetch branches: ${branchResponse.statusText}`);
    }
    
    const branchData = await branchResponse.json();
    const branch = branchData.branches?.find((b: any) => b.name === fullBranchName);
    
    if (!branch) {
      throw new Error(`Branch '${fullBranchName}' not found`);
    }
    
    const branchId = branch.id;
    console.log(`✅ Found branch ID: ${branchId}`);
    
    const connectionResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=verceldb&role_name=default`,
      {
        headers: {
          "Authorization": `Bearer ${neonApiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    if (!connectionResponse.ok) {
      throw new Error(`Failed to fetch connection URI: ${connectionResponse.statusText}`);
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
}

export interface SSMReadinessResult {
  ready: boolean;
  error?: string;
}

export async function validateSSMReadiness(
  instanceId: string, 
  region: string = "us-east-1"
): Promise<SSMReadinessResult> {
  const ec2 = new EC2({ region });
  const ssm = new SSM({ region });
  
  try {
    const instanceResult = await ec2.describeInstances({ InstanceIds: [instanceId] });
    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
    
    if (!instance || instance.State?.Name !== "running") {
      return { 
        ready: false, 
        error: `Instance is ${instance?.State?.Name || 'not found'}, must be running for SSM` 
      };
    }
    
    const ssmInstances = await ssm.describeInstanceInformation({
      Filters: [{ Key: "InstanceIds", Values: [instanceId] }]
    });
    
    if (!ssmInstances.InstanceInformationList?.length) {
      return { 
        ready: false, 
        error: "Instance not registered with Systems Manager" 
      };
    }
    
    const ssmInstance = ssmInstances.InstanceInformationList[0];
    
    if (ssmInstance.PingStatus !== "Online") {
      return { 
        ready: false, 
        error: `SSM agent is ${ssmInstance.PingStatus}, must be Online` 
      };
    }
    
    return { ready: true };
    
  } catch (error: any) {
    if (error.name === "InvalidInstanceID.NotFound") {
      return { ready: false, error: "Instance not found" };
    }
    return { ready: false, error: error.message };
  }
}

export async function checkInstanceHealth(instanceId: string, region: string = "us-east-1"): Promise<HealthCheckResult> {
  const ec2 = new EC2({ region });
  const ssm = new SSM({ region });
  
  try {
    const ssmValidation = await validateSSMReadiness(instanceId, region);
    if (!ssmValidation.ready) {
      return {
        instanceId,
        status: "offline",
        error: `Health check failed: ${ssmValidation.error}`
      };
    }

    try {
      const commandResult = await ssm.sendCommand({
        InstanceIds: [instanceId],
        DocumentName: "AWS-RunShellScript",
        Parameters: {
          commands: ["screen -ls"]
        },
        TimeoutSeconds: 30
      });

      const commandId = commandResult.Command?.CommandId;
      if (!commandId) {
        throw new Error("Failed to get command ID from SSM");
      }

      let attempts = 0;
      const maxAttempts = 40;
      let commandOutput = "";

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const outputResult = await ssm.getCommandInvocation({
            CommandId: commandId,
            InstanceId: instanceId
          });

          if (outputResult.Status === "Success") {
            commandOutput = outputResult.StandardOutputContent || "";
            break;
          } else if (outputResult.Status === "Failed") {
            throw new Error(`SSM command failed: ${outputResult.StandardErrorContent}`);
          }
        } catch (outputError) {
          if (attempts === maxAttempts - 1) {
            throw outputError;
          }
        }
        
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error("SSM command timed out");
      }

      const hasAgentSession = commandOutput.includes('agent-') || commandOutput.includes('\tagent\t');
      
      return {
        instanceId,
        status: hasAgentSession ? "healthy" : "unhealthy",
        error: hasAgentSession ? undefined : "No agent screen session found"
      };

    } catch (ssmError) {
      const errorMessage = ssmError instanceof Error ? ssmError.message : "SSM command failed";
      
      if (errorMessage.includes("InvalidInstanceId.NotFound") || 
          errorMessage.includes("not registered")) {
        return {
          instanceId,
          status: "offline",
          error: "Instance not managed by Systems Manager"
        };
      }

      return {
        instanceId,
        status: "offline",
        error: `SSM Command Failed to send: ${errorMessage}`
      };
    }

  } catch (error) {
    return {
      instanceId,
      status: "offline", 
      error: error instanceof Error ? `Check Instance Failed: ${error.message}` : "Health check failed"
    };
  }
}

export async function findOrCreateSSMInstanceProfile(region: string = "us-east-1"): Promise<string> {
  const iam = new IAM({ region });
  const roleName = "VargasJR-SSM-Role";
  const instanceProfileName = "VargasJR-SSM-InstanceProfile";
  
  try {
    const existingProfile = await iam.getInstanceProfile({ InstanceProfileName: instanceProfileName });
    return instanceProfileName;
  } catch (error: any) {
    if (error.name !== "NoSuchEntity") {
      throw error;
    }
  }
  
  const trustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ec2.amazonaws.com" },
        Action: "sts:AssumeRole"
      }
    ]
  };
  
  try {
    await iam.createRole({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: "Role for VargasJR EC2 instances to access Systems Manager"
    });
    
    await iam.attachRolePolicy({
      RoleName: roleName,
      PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    });
    
    console.log(`✅ Created IAM role: ${roleName}`);
  } catch (roleError: any) {
    if (roleError.name !== "EntityAlreadyExists") {
      throw roleError;
    }
    console.log(`⚠️  IAM role ${roleName} already exists`);
  }
  
  await iam.createInstanceProfile({
    InstanceProfileName: instanceProfileName,
    Description: "Instance profile for VargasJR EC2 instances"
  });
  
  await iam.addRoleToInstanceProfile({
    InstanceProfileName: instanceProfileName,
    RoleName: roleName
  });
  
  console.log(`✅ Created IAM instance profile: ${instanceProfileName}`);
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  return instanceProfileName;
}

export async function postGitHubComment(
  content: string, 
  userAgent: string, 
  successMessage: string = "Posted comment to PR"
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPOSITORY;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!githubToken || !githubRepo || eventName !== 'pull_request' || !eventPath) {
    console.log("Not in PR context or missing GitHub environment variables, skipping comment");
    return;
  }

  try {
    const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
    const prNumber = eventData.number;

    if (!prNumber) {
      console.log("No PR number found in event data");
      return;
    }

    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent
      },
      body: JSON.stringify({
        body: content
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    console.log(`✅ ${successMessage}`);
  } catch (error) {
    console.error("Failed to post GitHub comment:", error);
  }
}
