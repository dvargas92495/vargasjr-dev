import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { addInboxMessage } from "@/server";
import { NotFoundError } from "@/server/errors";
import { createErrorResponse } from "@/utils/error-response";

export async function POST(request: Request) {
  const requestId = `contact-form-${Date.now()}`;
  console.log(`[${requestId}] Processing contact form submission`);
  
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
      validatedData = z
        .object({
          email: z.string().email(),
          message: z.string(),
        })
        .parse(body);
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
              "Ensure 'email' field contains a valid email address",
              "Ensure 'message' field is provided and not empty"
            ]
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { email, message } = validatedData;

    try {
      await addInboxMessage({
        body: message,
        source: email,
        inboxName: "landing-page",
      });

      console.log(`[${requestId}] Successfully processed contact form from: ${email}`);
      return NextResponse.json({ success: true, requestId });
    } catch (inboxError) {
      console.error(`[${requestId}] Error adding inbox message:`, inboxError);
      
      if (inboxError instanceof NotFoundError) {
        return NextResponse.json(
          createErrorResponse("Inbox configuration error", {
            code: "INBOX_NOT_FOUND",
            details: inboxError.message,
            requestId,
            diagnostics: {
              inboxName: "landing-page",
              operation: "addInboxMessage"
            },
            troubleshooting: [
              "Check if the landing-page inbox exists in the database",
              "Verify inbox configuration is correct",
              "Contact system administrator"
            ]
          }),
          { status: 404 }
        );
      }

      throw inboxError;
    }
  } catch (error) {
    console.error(`[${requestId}] Unexpected error processing contact form:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to process contact form", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify database connectivity",
          "Try submitting the form again"
        ]
      }),
      { status: 500 }
    );
  }
}
