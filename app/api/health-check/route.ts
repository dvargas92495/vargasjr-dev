import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { SSM } from "@aws-sdk/client-ssm";
import { EC2 } from "@aws-sdk/client-ec2";

const healthCheckSchema = z.object({
  instanceId: z.string(),
  publicDns: z.string().optional(),
  keyName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instanceId } = healthCheckSchema.parse(body);
    try {
      const ec2 = new EC2({ region: "us-east-1" });
      const ssm = new SSM({ region: "us-east-1" });
      
      const instanceResult = await ec2.describeInstances({
        InstanceIds: [instanceId]
      });
      
      const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
      
      if (!instance) {
        return NextResponse.json({
          instanceId,
          status: "offline",
          error: "Instance not found"
        });
      }

      const instanceState = instance.State?.Name;
      if (instanceState !== "running") {
        return NextResponse.json({
          instanceId,
          status: "offline",
          error: `Instance is ${instanceState}`
        });
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
        const maxAttempts = 10;
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
        
        return NextResponse.json({
          instanceId,
          status: hasAgentSession ? "healthy" : "unhealthy",
          error: hasAgentSession ? null : "No agent screen session found"
        });

      } catch (ssmError) {
        const errorMessage = ssmError instanceof Error ? ssmError.message : "SSM command failed";
        
        if (errorMessage.includes("InvalidInstanceId.NotFound") || 
            errorMessage.includes("not registered")) {
          return NextResponse.json({
            instanceId,
            status: "offline",
            error: "Instance not managed by Systems Manager"
          });
        }

        return NextResponse.json({
          instanceId,
          status: "offline",
          error: errorMessage
        });
      }

    } catch (error) {
      return NextResponse.json({
        instanceId,
        status: "offline", 
        error: error instanceof Error ? error.message : "Health check failed"
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
