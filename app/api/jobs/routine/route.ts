import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { createErrorResponse } from "@/utils/error-response";
import formatZodError from "@/utils/format-zod-error";

export async function GET() {
  try {
    const db = getDb();
    const routineJobs = await db.select().from(RoutineJobsTable);
    return NextResponse.json(routineJobs);
  } catch (error) {
    const requestId = `routine-jobs-get-${Date.now()}`;
    console.error(`[${requestId}] Failed to fetch routine jobs:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to fetch routine jobs", {
        code: "DATABASE_ERROR",
        details: error instanceof Error ? error.message : String(error),
        requestId,
        diagnostics: {
          operation: "SELECT",
          table: "routine_jobs",
          errorName: error instanceof Error ? error.name : "Unknown"
        },
        troubleshooting: [
          "Check database connectivity",
          "Verify routine_jobs table exists and is accessible",
          "Check database permissions"
        ]
      }),
      { status: 500 }
    );
  }
}

const createRoutineJobSchema = z.object({
  name: z.string().min(1, "Name must not be empty"),
  cronExpression: z.string().min(1, "Cron expression must not be empty").regex(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    "Invalid cron expression format"
  )
});

export async function POST(request: Request) {
  const requestId = `routine-job-create-${Date.now()}`;
  console.log(`[${requestId}] Creating new routine job`);
  
  try {
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
      validatedData = createRoutineJobSchema.parse(body);
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
              "Ensure 'name' field is a non-empty string",
              "Ensure 'cronExpression' field is a valid cron expression (e.g., '0 9 * * 1-5')",
              "Check cron expression format: minute hour day month dayOfWeek"
            ]
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { name, cronExpression } = validatedData;

    try {
      const db = getDb();
      const newRoutineJob = await db
        .insert(RoutineJobsTable)
        .values({
          name,
          cronExpression,
          enabled: true,
        })
        .returning()
        .execute();

      console.log(`[${requestId}] Successfully created routine job:`, newRoutineJob[0]);
      return NextResponse.json(newRoutineJob[0]);
    } catch (dbError) {
      console.error(`[${requestId}] Database error creating routine job:`, dbError);
      
      let errorResponse;
      if (dbError instanceof Error && dbError.message.includes('unique constraint')) {
        errorResponse = createErrorResponse("Routine job with this name already exists", {
          code: "DUPLICATE_NAME",
          details: dbError.message,
          requestId,
          diagnostics: {
            operation: "INSERT",
            table: "routine_jobs",
            conflictField: "name",
            attemptedValue: name
          },
          troubleshooting: [
            "Choose a different name for the routine job",
            "Check existing routine jobs to avoid naming conflicts"
          ]
        });
      } else {
        errorResponse = createErrorResponse("Failed to create routine job", {
          code: "DATABASE_ERROR",
          details: dbError instanceof Error ? dbError.message : String(dbError),
          requestId,
          diagnostics: {
            operation: "INSERT",
            table: "routine_jobs",
            errorName: dbError instanceof Error ? dbError.name : "Unknown"
          },
          troubleshooting: [
            "Check database connectivity",
            "Verify routine_jobs table schema",
            "Check database permissions for INSERT operations"
          ]
        });
      }
      
      return NextResponse.json(errorResponse, { status: 500 });
    }
  } catch (error) {
    console.error(`[${requestId}] Unexpected error creating routine job:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to create routine job", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : String(error),
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify all required environment variables are set",
          "Ensure database is accessible"
        ]
      }),
      { status: 500 }
    );
  }
}
