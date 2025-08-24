import { EC2 } from "@aws-sdk/client-ec2";
import { IAMClient, GetInstanceProfileCommand } from "@aws-sdk/client-iam";
import { SecretsManager, RestoreSecretCommand } from "@aws-sdk/client-secrets-manager";
import { readFileSync } from "fs";
import { getGitHubAuthHeaders } from "@/app/lib/github-auth";
import {
  AGENT_SERVER_PORT,
  AWS_DEFAULT_REGION,
  DEFAULT_PRODUCTION_AGENT_NAME,
} from "@/server/constants";
import { retryWithBackoff } from "@/server/retry";

export interface EC2Instance {
  InstanceId?: string;
  State?: { Name?: string };
  Tags?: Array<{ Key?: string; Value?: string }>;
  ImageId?: string;
}

export function toAgentName(prNumber?: string): string {
  return prNumber
    ? `${DEFAULT_PRODUCTION_AGENT_NAME}-pr-${prNumber}`
    : DEFAULT_PRODUCTION_AGENT_NAME;
}

export function toSshKeySecretName(agentName: string): string {
  return `${agentName}-key`;
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
  region: string = AWS_DEFAULT_REGION
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
      error.name === "InvalidRequestException" &&
      error.message.includes("scheduled for deletion")
    ) {
      console.log(`⚠️  Secret ${secretName} is scheduled for deletion, restoring...`);
      
      try {
        await secretsManager.send(new RestoreSecretCommand({
          SecretId: secretName,
        }));
        
        console.log(`✅ Secret ${secretName} restored from deletion`);
        
        await secretsManager.updateSecret({
          SecretId: secretName,
          SecretString: secretValue,
        });
        
        console.log(`✅ Secret updated: ${secretName}`);
      } catch (restoreError: any) {
        if (
          restoreError.name === "AccessDeniedException" ||
          restoreError.name === "UnauthorizedOperation"
        ) {
          console.warn(
            `⚠️  Insufficient permissions to restore secret ${secretName}: ${restoreError.message}`
          );
          return;
        }
        throw restoreError;
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
  region: string = AWS_DEFAULT_REGION
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
  region: string = AWS_DEFAULT_REGION
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

export async function checkInstanceHealth(
  instanceId: string,
  region: string = AWS_DEFAULT_REGION
): Promise<HealthCheckResult> {
  const ec2 = new EC2({ region });

  try {
    const instanceResult = await ec2.describeInstances({
      InstanceIds: [instanceId],
    });

    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      return {
        instanceId,
        status: "offline",
        error: "Instance not found",
      };
    }

    if (instance.State?.Name !== "running") {
      return {
        instanceId,
        status: "offline",
        error: `Instance is ${instance.State?.Name}`,
      };
    }

    const publicIp = instance.PublicIpAddress;
    if (!publicIp) {
      return {
        instanceId,
        status: "offline",
        error: "Instance has no public IP address",
      };
    }

    const healthUrl = `http://${publicIp}:${AGENT_SERVER_PORT}/health`;
    console.log(`[Health Check] Making HTTP request to: ${healthUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          instanceId,
          status: "offline",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const healthData = await response.json();

      return {
        instanceId,
        status: healthData.status === "healthy" ? "healthy" : "unhealthy",
        error: healthData.status !== "healthy" ? healthData.error : undefined,
        diagnostics: {
          healthcheck: healthData,
        },
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return {
          instanceId,
          status: "offline",
          error: "Health check request timed out after 10 seconds",
        };
      }

      return {
        instanceId,
        status: "offline",
        error: `HTTP request failed: ${
          fetchError instanceof Error ? fetchError.message : String(fetchError)
        }`,
      };
    }
  } catch (error) {
    return {
      instanceId,
      status: "offline",
      error: `Failed to get instance details: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export async function findOrCreateSSMInstanceProfile(): Promise<string> {
  const iam = new IAMClient({ region: AWS_DEFAULT_REGION });
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

export async function postGitHubComment(
  content: string,
  userAgent: string,
  successMessage: string = "Posted comment to PR"
): Promise<void> {
  const githubRepo = "dvargas92495/vargasjr-dev";
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!githubRepo || eventName !== "pull_request" || !eventPath) {
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
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
          );
        } else {
          throw new Error(
            `GitHub API client error: ${response.status} ${response.statusText}`
          );
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
