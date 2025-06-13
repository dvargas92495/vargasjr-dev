import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { execSync } from "child_process";

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

    try {
      const keyPath = `${process.env.HOME}/.ssh/${keyName}.pem`;
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
        status: "unhealthy", 
        error: error instanceof Error ? error.message : "SSH connection failed"
      });
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
