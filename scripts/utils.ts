import { EC2 } from "@aws-sdk/client-ec2";
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
