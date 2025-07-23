import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { cookies } from "next/headers";
import formatZodError from "@/utils/format-zod-error";

const instanceSchema = z.object({
  id: z.string(),
  operation: z.enum(["STOP", "START"]),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, operation } = instanceSchema.parse(body);
    
    const ec2 = new EC2({ region: "us-east-1" });
    
    if (operation === "STOP") {
      await ec2.stopInstances({ InstanceIds: [id] });
      return NextResponse.json({ 
        success: true, 
        message: "Instance stop initiated",
        instanceId: id,
        operation: "STOP"
      });
    } else if (operation === "START") {
      await ec2.startInstances({ InstanceIds: [id] });
      return NextResponse.json({ 
        success: true, 
        message: "Instance start initiated",
        instanceId: id,
        operation: "START"
      });
    }

    return NextResponse.json(
      { error: "Invalid operation" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `Invalid request body: ${formatZodError(error)}` },
        { status: 400 }
      );
    }

    console.error("Instance operation failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
