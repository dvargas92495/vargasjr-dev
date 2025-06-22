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
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, operation } = instanceSchema.parse(body);
    
    const ec2 = new EC2({ region: "us-east-1" });
    
    if (operation === "STOP") {
      await ec2.stopInstances({ InstanceIds: [id] });
      return NextResponse.json({ success: true, message: "Instance stop initiated" });
    } else if (operation === "START") {
      await ec2.startInstances({ InstanceIds: [id] });
      return NextResponse.json({ success: true, message: "Instance start initiated" });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}
