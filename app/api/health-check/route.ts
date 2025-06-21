import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { execSync } from "child_process";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import { writeFileSync, unlinkSync } from "fs";
import { EC2 } from "@aws-sdk/client-ec2";
import { tmpdir } from "os";

const healthCheckSchema = z.object({
  instanceId: z.string(),
  publicDns: z.string(),
  keyName: z.string(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instanceId, publicDns, keyName } = healthCheckSchema.parse(body);

    if (!publicDns) {
      return NextResponse.json({ 
        instanceId, 
        status: "unhealthy", 
        error: "Instance has no public DNS" 
      });
    }

    let keyPath: string;
    let tempKeyPath: string | null = null;
    
    try {
      const ec2 = new EC2({ region: "us-east-1" });
      const instanceResult = await ec2.describeInstances({
        InstanceIds: [instanceId]
      });
      
      const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
      const prNumber = instance?.Tags?.find(tag => tag.Key === "PRNumber")?.Value;
      
      const env = prNumber ? `pr-${prNumber}` : "prod";
      const secretName = `vargasjr-${env}-${keyName}-pem`;
      
      try {
        const secretsManager = new SecretsManager({ region: "us-east-1" });
        const result = await secretsManager.getSecretValue({
          SecretId: secretName
        });
        
        if (result.SecretString) {
          tempKeyPath = `${tmpdir()}/${keyName}-${Date.now()}.pem`;
          writeFileSync(tempKeyPath, result.SecretString, { mode: 0o600 });
          keyPath = tempKeyPath;
          
          console.log(`✅ Retrieved SSH key from Secrets Manager: ${secretName}`);
        } else {
          keyPath = `${process.env.HOME || '/home/ubuntu'}/.ssh/${keyName}.pem`;
        }
      } catch (secretsError) {
        console.log(`⚠️  Failed to retrieve from Secrets Manager, falling back to local file: ${secretsError}`);
        keyPath = `${process.env.HOME || '/home/ubuntu'}/.ssh/${keyName}.pem`;
      }
      
      const sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes -o UserKnownHostsFile=/dev/null ubuntu@${publicDns} "screen -ls"`;
      
      const output = execSync(sshCommand, { 
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 15000
      });

      const hasAgentSession = output.includes('agent-') || output.includes('\tagent\t');
      
      return NextResponse.json({
        instanceId,
        status: hasAgentSession ? "healthy" : "unhealthy",
        error: hasAgentSession ? null : "No agent screen session found"
      });

    } catch (error) {
      return NextResponse.json({
        instanceId,
        status: "offline", 
        error: error instanceof Error ? error.message : "SSH connection failed"
      });
    } finally {
      if (tempKeyPath) {
        try {
          unlinkSync(tempKeyPath);
        } catch (cleanupError) {
          console.error(`Failed to cleanup temp key file: ${cleanupError}`);
        }
      }
    }

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
