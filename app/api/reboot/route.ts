import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { SSM } from "@aws-sdk/client-ssm";
import { checkInstanceHealth } from "@/scripts/utils";

const rebootSchema = z.object({
  instanceId: z.string(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instanceId } = rebootSchema.parse(body);
    
    try {
      const ssm = new SSM({ region: "us-east-1" });
      
      const healthCheck = await checkInstanceHealth(instanceId);
      if (healthCheck.status !== "healthy") {
        return NextResponse.json({
          error: `Cannot reboot agent: ${healthCheck.error}`
        }, { status: 400 });
      }

      const commandResult = await ssm.sendCommand({
        InstanceIds: [instanceId],
        DocumentName: "AWS-RunShellScript",
        Parameters: {
          commands: ["~/run_agent.sh"]
        },
        TimeoutSeconds: 60
      });

      const commandId = commandResult.Command?.CommandId;
      if (!commandId) {
        throw new Error("Failed to get command ID from SSM");
      }

      return NextResponse.json({
        success: true,
        commandId: commandId,
        message: "Agent reboot initiated"
      });

    } catch (awsError) {
      const errorMessage = awsError instanceof Error ? awsError.message : "AWS error";
      
      if (errorMessage.includes("Could not load credentials")) {
        console.log("AWS credentials not available - returning mock success for development");
        
        return NextResponse.json({
          success: true,
          commandId: "mock-command-id-dev",
          message: "Agent reboot initiated (development mode)",
          isDevelopment: true
        });
      }
      
      if (errorMessage.includes("InvalidInstanceId.NotFound") || 
          errorMessage.includes("not registered")) {
        return NextResponse.json({
          error: "Instance not managed by Systems Manager"
        }, { status: 400 });
      }

      return NextResponse.json({
        error: errorMessage
      }, { status: 500 });
    }

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Reboot failed" },
      { status: 500 }
    );
  }
}
