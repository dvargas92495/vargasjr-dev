import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { cookies } from "next/headers";

const instanceSchema = z.object({
  id: z.string(),
  operation: z.enum(["STOP", "START"]),
});

export async function POST(request: Request) {
  try {
    console.log(`[/api/instances] POST request received`);
    
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");
    console.log(`[/api/instances] Admin token present: ${!!token?.value}`);

    if (token?.value !== process.env.ADMIN_TOKEN) {
      console.log(`[/api/instances] Authentication failed - token mismatch`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log(`[/api/instances] Request body:`, body);
    const { id, operation } = instanceSchema.parse(body);
    console.log(`[/api/instances] Parsed - Instance ID: ${id}, Operation: ${operation}`);
    
    console.log(`[/api/instances] Initializing EC2 client for region us-east-1`);
    const ec2 = new EC2({ region: "us-east-1" });
    
    if (operation === "STOP") {
      console.log(`[/api/instances] Stopping instance ${id}`);
      const result = await ec2.stopInstances({ InstanceIds: [id] });
      console.log(`[/api/instances] Stop command result:`, result);
      return NextResponse.json({ success: true, message: "Instance stop initiated", result });
    } else if (operation === "START") {
      console.log(`[/api/instances] Starting instance ${id}`);
      const result = await ec2.startInstances({ InstanceIds: [id] });
      console.log(`[/api/instances] Start command result:`, result);
      return NextResponse.json({ success: true, message: "Instance start initiated", result });
    }

    console.log(`[/api/instances] Invalid operation: ${operation}`);
    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });

  } catch (error) {
    console.error(`[/api/instances] Operation failed:`, error);
    
    if (error instanceof ZodError) {
      console.error(`[/api/instances] Validation error:`, error.message);
      return NextResponse.json(
        { error: "Invalid request body", details: error.message },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error(`[/api/instances] Error details:`, {
      name: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    return NextResponse.json(
      { error: "Operation failed", details: errorMessage },
      { status: 500 }
    );
  }
}
