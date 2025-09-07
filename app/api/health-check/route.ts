import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import {
  EC2,
  GetConsoleOutputCommand,
  type DescribeInstancesCommandOutput,
  type Instance as EC2Instance,
} from "@aws-sdk/client-ec2";
import { AGENT_SERVER_PORT, AWS_DEFAULT_REGION, LOCAL_AGENT_INSTANCE_ID } from "@/server/constants";

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

function parseMemoryDiagnostics(
  consoleOutput: string,
  consoleOutputError?: string
): {
  hasMemoryIssues: boolean;
  memoryErrors: string[];
  consoleOutputError?: string;
} {
  const memoryPatterns = /out of memory|oom-killer|Killed process/gi;
  const lines = consoleOutput.split("\n");
  const memoryErrors: string[] = [];

  lines.forEach((line) => {
    if (memoryPatterns.test(line)) {
      memoryErrors.push(line.trim());
    }
  });

  return {
    hasMemoryIssues: memoryErrors.length > 0,
    memoryErrors,
    ...(consoleOutputError && { consoleOutputError }),
  };
}

async function checkInstanceHealthHTTP(
  instanceId: string,
  region: string = AWS_DEFAULT_REGION
): Promise<HealthCheckResult> {
  if (instanceId === LOCAL_AGENT_INSTANCE_ID) {
    try {
      const healthUrl = `http://localhost:${AGENT_SERVER_PORT}/health`;
      console.log(
        `[Health Check] Making HTTP request to local agent: ${healthUrl}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            instanceId,
            status: "offline",
            error: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: new Date().toISOString(),
          };
        }

        const healthData = await response.json();
        return {
          instanceId,
          status: healthData.status === "healthy" ? "healthy" : "unhealthy",
          error: healthData.status !== "healthy" ? healthData.error : undefined,
          timestamp: new Date().toISOString(),
          diagnostics: {
            healthcheck: healthData,
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return {
          instanceId,
          status: "offline",
          error: `Local agent connection failed: ${
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError)
          }`,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        instanceId,
        status: "offline",
        error: `Failed to check local agent: ${
          error instanceof Error ? error.message : String(error)
        }`,
        timestamp: new Date().toISOString(),
      };
    }
  }

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
        timestamp: new Date().toISOString(),
      };
    }

    if (instance.State?.Name !== "running") {
      return {
        instanceId,
        status: "offline",
        error: `Instance is ${instance.State?.Name}`,
        timestamp: new Date().toISOString(),
      };
    }

    const publicIp =
      instancePublicIp(instanceResult, instance) || instance.PublicIpAddress;
    if (!publicIp) {
      return {
        instanceId,
        status: "offline",
        error: "Instance has no public IP address",
        timestamp: new Date().toISOString(),
      };
    }

    const healthUrl = `http://${publicIp}:${AGENT_SERVER_PORT}/health`;
    console.log(`[Health Check] Making HTTP request to: ${healthUrl}`);

    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const durationMs = Date.now() - startedAt;
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
        } catch {
          bodyText = undefined;
        }
        return {
          instanceId,
          status: "offline",
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
          diagnostics: {
            networkError: {
              type: "http_error",
              statusCode: response.status,
              statusText: response.statusText,
              message: bodyText || response.statusText,
              timing: durationMs,
              connectivity: {
                healthCheckApi: false,
                basicConnectivity: true,
              },
              attemptedUrl: healthUrl,
            },
          },
        };
      }

      let healthData: unknown;
      try {
        healthData = await response.json();
      } catch (e) {
        const durationMs = Date.now() - startedAt;
        return {
          instanceId,
          status: "offline",
          error: "Failed to parse health check response JSON",
          timestamp: new Date().toISOString(),
          diagnostics: {
            networkError: {
              type: "parse_error",
              message:
                e instanceof Error ? e.message : "Unknown JSON parse error",
              timing: durationMs,
              connectivity: {
                healthCheckApi: true,
                basicConnectivity: true,
              },
              attemptedUrl: healthUrl,
            },
          },
        };
      }

      const hd = (healthData ?? {}) as Record<string, unknown>;
      const statusStr = typeof hd.status === "string" ? hd.status : undefined;
      const errorStr = typeof hd.error === "string" ? hd.error : undefined;
      return {
        instanceId,
        status: statusStr === "healthy" ? "healthy" : "unhealthy",
        error: statusStr !== "healthy" ? errorStr : undefined,
        timestamp: new Date().toISOString(),
        diagnostics: hd,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startedAt;
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        let memoryDiagnostics = undefined;
        try {
          const consoleCommand = new GetConsoleOutputCommand({
            InstanceId: instanceId,
            Latest: true,
          });
          const consoleResult = await ec2.send(consoleCommand);

          if (consoleResult.Output) {
            const decodedOutput = Buffer.from(
              consoleResult.Output,
              "base64"
            ).toString("utf-8");
            memoryDiagnostics = parseMemoryDiagnostics(decodedOutput);
          }
        } catch (consoleError) {
          const consoleOutputError =
            consoleError instanceof Error
              ? consoleError.message
              : String(consoleError);
          memoryDiagnostics = parseMemoryDiagnostics("", consoleOutputError);
        }

        return {
          instanceId,
          status: "offline",
          error: "Health check request timed out after 10 seconds",
          timestamp: new Date().toISOString(),
          diagnostics: {
            networkError: {
              type: "fetch_failed",
              message: "Request aborted due to timeout",
              timing: durationMs,
              connectivity: {
                healthCheckApi: false,
                basicConnectivity: false,
              },
              attemptedUrl: healthUrl,
              errorName: fetchError.name,
              timedOut: true,
            },
            ...(memoryDiagnostics && { memoryDiagnostics }),
          },
        };
      }

      const errMsg =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      const errName = fetchError instanceof Error ? fetchError.name : "Error";
      const errCodeUnknown =
        fetchError && typeof fetchError === "object" && "code" in fetchError
          ? (fetchError as { code?: unknown }).code
          : undefined;
      const errCode =
        typeof errCodeUnknown === "string" || typeof errCodeUnknown === "number"
          ? errCodeUnknown
          : undefined;

      return {
        instanceId,
        status: "offline",
        error: `HTTP request failed: ${errMsg}`,
        timestamp: new Date().toISOString(),
        diagnostics: {
          networkError: {
            type: "fetch_failed",
            message: errMsg,
            timing: durationMs,
            connectivity: {
              healthCheckApi: false,
              basicConnectivity: false,
            },
            attemptedUrl: healthUrl,
            errorName: errName,
            errorCode: errCode,
          },
        },
      };
    }
  } catch (error) {
    return {
      instanceId,
      status: "offline",
      error: `Failed to get instance details: ${
        error instanceof Error ? error.message : String(error)
      }`,
      timestamp: new Date().toISOString(),
    };
  }
}

function instancePublicIp(
  _instanceResult: DescribeInstancesCommandOutput,
  instance: EC2Instance | undefined
): string | undefined {
  return instance?.PublicIpAddress;
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
    console.log(
      `[Health Check] Request validation completed in ${validationDuration}ms for instanceId: ${instanceId}`
    );

    try {
      console.log(
        `[Health Check] Starting health check for instance: ${instanceId}`
      );
      const healthCheckStartTime = Date.now();
      const healthResult = await checkInstanceHealthHTTP(instanceId);
      const healthCheckDuration = Date.now() - healthCheckStartTime;

      console.log(
        `[Health Check] Health check completed in ${healthCheckDuration}ms`
      );
      console.log(
        `[Health Check] Result:`,
        JSON.stringify(healthResult, null, 2)
      );

      const totalDuration = Date.now() - requestStartTime;
      console.log(`[Health Check] Total request duration: ${totalDuration}ms`);

      return NextResponse.json(healthResult);
    } catch (error) {
      const healthCheckDuration = Date.now() - requestStartTime;
      const errorMessage =
        error instanceof Error ? error.message : "Health check failed";
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(
        `[Health Check] Health check failed after ${healthCheckDuration}ms`
      );
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
        timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Health check failed";
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
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
export async function HEAD() {
  return new Response(null, { status: 200 });
}
