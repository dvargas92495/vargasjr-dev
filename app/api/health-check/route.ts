import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { checkInstanceHealth } from "@/server/health";

const healthCheckSchema = z.object({
  instanceId: z.string(),
  publicDns: z.string().optional(),
  keyName: z.string().optional(),
});

export async function POST(request: Request) {
  const requestStartTime = Date.now();
  console.log(`[Health Check] Request started at ${new Date().toISOString()}`);
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      console.log(`[Health Check] Authentication failed - invalid admin token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log(`[Health Check] Request body:`, JSON.stringify(body, null, 2));
    
    const validationStartTime = Date.now();
    const { instanceId } = healthCheckSchema.parse(body);
    const validationDuration = Date.now() - validationStartTime;
    console.log(`[Health Check] Request validation completed in ${validationDuration}ms for instanceId: ${instanceId}`);
    
    try {
      console.log(`[Health Check] Starting health check for instance: ${instanceId}`);
      const healthCheckStartTime = Date.now();
      const healthResult = await checkInstanceHealth(instanceId, "us-east-1", 1);
      const healthCheckDuration = Date.now() - healthCheckStartTime;
      
      console.log(`[Health Check] Health check completed in ${healthCheckDuration}ms`);
      console.log(`[Health Check] Result:`, JSON.stringify(healthResult, null, 2));
      
      const totalDuration = Date.now() - requestStartTime;
      console.log(`[Health Check] Total request duration: ${totalDuration}ms`);
      
      return NextResponse.json(healthResult);
    } catch (error) {
      const healthCheckDuration = Date.now() - requestStartTime;
      const errorMessage = error instanceof Error ? error.message : "Health check failed";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[Health Check] Health check failed after ${healthCheckDuration}ms`);
      console.error(`[Health Check] Error message: ${errorMessage}`);
      if (errorStack) {
        console.error(`[Health Check] Error stack:`, errorStack);
      }
      console.error(`[Health Check] Error object:`, error);
      
      return NextResponse.json({
        instanceId,
        status: "offline", 
        error: errorMessage,
        duration: healthCheckDuration,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[Health Check] Request failed after ${totalDuration}ms`);
    
    if (error instanceof ZodError) {
      console.error(`[Health Check] Validation error:`, error.errors);
      return NextResponse.json(
        { 
          error: "Invalid request body",
          validationErrors: error.errors,
          duration: totalDuration,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Health check failed";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[Health Check] Unexpected error: ${errorMessage}`);
    if (errorStack) {
      console.error(`[Health Check] Error stack:`, errorStack);
    }

    return NextResponse.json(
      { 
        error: "Health check failed",
        details: errorMessage,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
