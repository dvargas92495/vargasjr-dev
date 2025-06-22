import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { checkInstanceHealth } from "../../../scripts/utils";

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
      const healthResult = await checkInstanceHealth(instanceId);
      return NextResponse.json(healthResult);
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
