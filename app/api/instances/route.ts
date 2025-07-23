import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { cookies } from "next/headers";
import { createErrorResponse } from "@/utils/error-response";
import formatZodError from "@/utils/format-zod-error";

const instanceSchema = z.object({
  id: z.string(),
  operation: z.enum(["STOP", "START"]),
});

export async function POST(request: Request) {
  const requestId = `instance-operation-${Date.now()}`;
  console.log(`[${requestId}] Starting instance operation`);
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      console.log(`[${requestId}] Authentication failed - invalid admin token`);
      return NextResponse.json(
        createErrorResponse("Unauthorized", {
          code: "AUTH_FAILED",
          requestId,
          troubleshooting: [
            "Ensure you are logged in as an administrator",
            "Check if your session has expired"
          ]
        }),
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse request body:`, parseError);
      return NextResponse.json(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details: parseError instanceof Error ? parseError.message : "Request body is not valid JSON",
          requestId,
          troubleshooting: [
            "Ensure request body contains valid JSON",
            "Check Content-Type header is application/json"
          ]
        }),
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = instanceSchema.parse(body);
    } catch (validationError) {
      console.error(`[${requestId}] Request validation failed:`, validationError);
      if (validationError instanceof ZodError) {
        return NextResponse.json(
          createErrorResponse("Request validation failed", {
            code: "VALIDATION_ERROR",
            details: formatZodError(validationError),
            requestId,
            diagnostics: {
              receivedData: body,
              validationErrors: validationError.errors
            },
            troubleshooting: [
              "Ensure 'id' field contains a valid instance ID",
              "Ensure 'operation' field is either 'START' or 'STOP'"
            ]
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { id, operation } = validatedData;
    console.log(`[${requestId}] Performing ${operation} operation on instance: ${id}`);
    
    try {
      const ec2 = new EC2({ region: "us-east-1" });
      
      if (operation === "STOP") {
        const result = await ec2.stopInstances({ InstanceIds: [id] });
        console.log(`[${requestId}] Stop operation result:`, result);
        return NextResponse.json({ 
          success: true, 
          message: "Instance stop initiated",
          requestId,
          instanceId: id,
          operation: "STOP"
        });
      } else if (operation === "START") {
        const result = await ec2.startInstances({ InstanceIds: [id] });
        console.log(`[${requestId}] Start operation result:`, result);
        return NextResponse.json({ 
          success: true, 
          message: "Instance start initiated",
          requestId,
          instanceId: id,
          operation: "START"
        });
      }

      return NextResponse.json(
        createErrorResponse("Invalid operation", {
          code: "INVALID_OPERATION",
          details: `Operation '${operation}' is not supported`,
          requestId,
          troubleshooting: [
            "Use 'START' to start an instance",
            "Use 'STOP' to stop an instance"
          ]
        }),
        { status: 400 }
      );

    } catch (awsError) {
      console.error(`[${requestId}] AWS error during ${operation} operation:`, awsError);
      
      let errorResponse;
      if (awsError instanceof Error) {
        if (awsError.message.includes("InvalidInstanceID.NotFound")) {
          errorResponse = createErrorResponse("Instance not found", {
            code: "INSTANCE_NOT_FOUND",
            details: `Instance ${id} does not exist or is not accessible`,
            requestId,
            diagnostics: {
              instanceId: id,
              operation: operation,
              awsRegion: "us-east-1"
            },
            troubleshooting: [
              "Verify the instance ID is correct",
              "Check if the instance exists in the us-east-1 region",
              "Ensure you have permissions to access this instance"
            ]
          });
        } else if (awsError.message.includes("UnauthorizedOperation")) {
          errorResponse = createErrorResponse("AWS operation not authorized", {
            code: "AWS_UNAUTHORIZED",
            details: "Insufficient permissions to perform this operation",
            requestId,
            diagnostics: {
              instanceId: id,
              operation: operation,
              awsError: awsError.message
            },
            troubleshooting: [
              "Check AWS IAM permissions for EC2 operations",
              "Verify the AWS credentials have the required policies",
              "Ensure the instance is in the correct AWS account"
            ]
          });
        } else if (awsError.message.includes("Could not load credentials")) {
          errorResponse = createErrorResponse("AWS credentials not available", {
            code: "AWS_CREDENTIALS_ERROR",
            details: "Unable to load AWS credentials",
            requestId,
            troubleshooting: [
              "Check AWS credentials configuration",
              "Verify environment variables or IAM role setup",
              "Ensure AWS SDK can access credentials"
            ]
          });
        } else {
          errorResponse = createErrorResponse("AWS operation failed", {
            code: "AWS_ERROR",
            details: awsError.message,
            requestId,
            diagnostics: {
              instanceId: id,
              operation: operation,
              errorName: awsError.name,
              awsRegion: "us-east-1"
            },
            troubleshooting: [
              "Check AWS service status",
              "Verify instance state allows this operation",
              "Try the operation again after a few minutes"
            ]
          });
        }
      } else {
        errorResponse = createErrorResponse("Unknown AWS error", {
          code: "AWS_UNKNOWN_ERROR",
          details: String(awsError),
          requestId,
          troubleshooting: [
            "Check AWS service status",
            "Review server logs for more details"
          ]
        });
      }

      return NextResponse.json(errorResponse, { status: 500 });
    }

  } catch (error) {
    console.error(`[${requestId}] Unexpected error during instance operation:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Instance operation failed", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify AWS credentials and permissions",
          "Try the operation again"
        ]
      }),
      { status: 500 }
    );
  }
}
