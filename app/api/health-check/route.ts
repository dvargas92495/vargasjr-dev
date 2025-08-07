import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { EC2 } from "@aws-sdk/client-ec2";
import { AGENT_SERVER_PORT } from "../../../server/constants";

const healthCheckSchema = z.object({
  instanceId: z.string(),
  publicDns: z.string().optional(),
  keyName: z.string().optional(),
});

interface HealthCheckResult {
  instanceId: string;
  status: "healthy" | "unhealthy" | "offline";
  error?: string;
  timestamp?: string;
  diagnostics?: Record<string, unknown>;
}

async function checkInstanceHealthHTTP(
  instanceId: string,
  region: string = "us-east-1"
): Promise<HealthCheckResult> {
  const ec2 = new EC2({ region });
  
  try {
    const instanceResult = await ec2.describeInstances({
      InstanceIds: [instanceId],
    });
    
    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      return {
        instanceId,
        status: "offline",
        error: "Instance not found",
        timestamp: new Date().toISOString()
      };
    }
    
    if (instance.State?.Name !== "running") {
      return {
        instanceId,
        status: "offline",
        error: `Instance is ${instance.State?.Name}`,
        timestamp: new Date().toISOString()
      };
    }
    
    const publicIp = instance.PublicIpAddress;
    if (!publicIp) {
      return {
        instanceId,
        status: "offline",
        error: "Instance has no public IP address",
        timestamp: new Date().toISOString()
      };
    }
    
    const healthUrl = `http://${publicIp}:${AGENT_SERVER_PORT}/health`;
    console.log(`[Health Check] Making HTTP request to: ${healthUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return {
          instanceId,
          status: "offline",
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString()
        };
      }
      
      const healthData = await response.json();
      
      return {
        instanceId,
        status: healthData.status === "healthy" ? "healthy" : "unhealthy",
        error: healthData.status !== "healthy" ? healthData.error : undefined,
        timestamp: new Date().toISOString(),
        diagnostics: healthData
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          instanceId,
          status: "offline",
          error: "Health check request timed out after 10 seconds",
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        instanceId,
        status: "offline",
        error: `HTTP request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    return {
      instanceId,
      status: "offline",
      error: `Failed to get instance details: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString()
    };
  }
}

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
      const healthResult = await checkInstanceHealthHTTP(instanceId);
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
