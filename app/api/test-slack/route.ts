import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createHmac } from "node:crypto";
import { createErrorResponse } from "@/utils/error-response";
import formatZodError from "@/utils/format-zod-error";
import { internalFetch } from "@/utils/internal-fetch";

const testRequestSchema = z.object({
  channel: z.string().min(1),
  message: z.string().min(1),
  user: z.string().min(1),
});

export async function POST(request: Request) {
  const requestId = `test-slack-${Date.now()}`;
  console.log(`[${requestId}] Starting Slack webhook test`);

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse request body:`, parseError);
      return NextResponse.json(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details:
            parseError instanceof Error
              ? parseError.message
              : "Request body is not valid JSON",
          requestId,
          troubleshooting: [
            "Ensure request body contains valid JSON",
            "Check Content-Type header is application/json",
          ],
        }),
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = testRequestSchema.parse(body);
    } catch (validationError) {
      console.error(
        `[${requestId}] Request validation failed:`,
        validationError
      );
      if (validationError instanceof ZodError) {
        return NextResponse.json(
          createErrorResponse("Request validation failed", {
            code: "VALIDATION_ERROR",
            details: formatZodError(validationError),
            requestId,
            diagnostics: {
              receivedData: body,
              validationErrors: validationError.errors,
            },
            troubleshooting: [
              "Ensure 'channel' field is a non-empty string",
              "Ensure 'message' field is a non-empty string",
              "Ensure 'user' field is a non-empty string",
              "Check the request payload structure",
            ],
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { channel, message, user } = validatedData;
    const channelName = channel.startsWith("#") ? channel.slice(1) : channel;

    console.log(
      `[${requestId}] Creating test event for channel: ${channelName}`
    );

    const slackEvent = {
      type: "event_callback",
      event: {
        type: "message",
        text: message,
        user: user,
        channel: channelName,
        ts: Date.now() / 1000,
      },
    };

    const eventBody = JSON.stringify(slackEvent);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let signature;
    try {
      const testSecret = process.env.SLACK_SIGNING_SECRET;
      if (!testSecret) {
        console.error(
          `[${requestId}] SLACK_SIGNING_SECRET environment variable is not set`
        );
        return NextResponse.json(
          createErrorResponse("Missing Slack signing secret", {
            code: "MISSING_SECRET",
            details:
              "SLACK_SIGNING_SECRET environment variable is required for test endpoint",
            requestId,
            troubleshooting: [
              "Set SLACK_SIGNING_SECRET environment variable",
              "Check your environment configuration",
              "Ensure the secret matches your Slack app configuration",
            ],
          }),
          { status: 500 }
        );
      }

      const signatureVersion = "v0";
      const hmac = createHmac("sha256", testSecret);
      hmac.update(`${signatureVersion}:${timestamp}:${eventBody}`);
      signature = `${signatureVersion}=${hmac.digest("hex")}`;
    } catch (signatureError) {
      console.error(
        `[${requestId}] Failed to generate signature:`,
        signatureError
      );
      return NextResponse.json(
        createErrorResponse("Failed to generate webhook signature", {
          code: "SIGNATURE_ERROR",
          details:
            signatureError instanceof Error
              ? signatureError.message
              : "Unknown signature error",
          requestId,
          troubleshooting: [
            "Check if crypto module is available",
            "Verify signature generation logic",
          ],
        }),
        { status: 500 }
      );
    }

    const webhookUrl = `${request.url.split("/api/")[0]}/api/slack`;
    console.log(`[${requestId}] Sending webhook request to: ${webhookUrl}`);

    let webhookResponse;
    try {
      webhookResponse = await internalFetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slack-request-timestamp": timestamp,
          "x-slack-signature": signature,
        },
        body: eventBody,
      });
    } catch (internalError) {
      console.error(
        `[${requestId}] Error calling internal webhook:`,
        internalError
      );
      return NextResponse.json(
        createErrorResponse("Failed to call internal webhook", {
          code: "INTERNAL_WEBHOOK_ERROR",
          details:
            internalError instanceof Error
              ? internalError.message
              : "Error calling internal webhook handler",
          requestId,
          diagnostics: {
            webhookUrl,
            errorName:
              internalError instanceof Error ? internalError.name : "Unknown",
          },
          troubleshooting: [
            "Check if the internal route handler exists",
            "Verify the route module can be imported",
            "Check for errors in the target endpoint",
          ],
        }),
        { status: 500 }
      );
    }

    let responseText;
    try {
      responseText = await webhookResponse.text();
    } catch (readError) {
      console.error(
        `[${requestId}] Failed to read webhook response:`,
        readError
      );
      return NextResponse.json(
        createErrorResponse("Failed to read webhook response", {
          code: "RESPONSE_READ_ERROR",
          details:
            readError instanceof Error
              ? readError.message
              : "Unable to read response body",
          requestId,
          diagnostics: {
            statusCode: webhookResponse.status,
            statusText: webhookResponse.statusText,
            headers: Object.fromEntries(webhookResponse.headers.entries()),
          },
          troubleshooting: [
            "Check if the webhook endpoint is accessible",
            "Verify network connectivity to the webhook endpoint",
          ],
        }),
        { status: 500 }
      );
    }

    let webhookResult;
    const contentType = webhookResponse.headers.get("content-type") || "";
    const isJsonResponse = contentType.includes("application/json");

    if (webhookResponse.ok && isJsonResponse) {
      try {
        webhookResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          `[${requestId}] Failed to parse JSON webhook response:`,
          parseError
        );
        return NextResponse.json(
          createErrorResponse("Failed to parse webhook response", {
            code: "RESPONSE_PARSE_ERROR",
            details:
              parseError instanceof Error
                ? parseError.message
                : "Invalid JSON response",
            requestId,
            diagnostics: {
              statusCode: webhookResponse.status,
              statusText: webhookResponse.statusText,
              responseText: responseText.substring(0, 500),
              contentType: contentType,
              headers: Object.fromEntries(webhookResponse.headers.entries()),
            },
            troubleshooting: [
              "Check if the webhook endpoint returns valid JSON",
              "Verify the webhook endpoint is functioning correctly",
            ],
          }),
          { status: 500 }
        );
      }
    } else {
      console.error(
        `[${requestId}] Webhook returned non-JSON or error response:`,
        webhookResponse.status,
        responseText.substring(0, 200)
      );
      return NextResponse.json(
        createErrorResponse("Webhook returned error response", {
          code: "WEBHOOK_ERROR_RESPONSE",
          details: `Webhook returned ${webhookResponse.status} ${webhookResponse.statusText}`,
          requestId,
          diagnostics: {
            statusCode: webhookResponse.status,
            statusText: webhookResponse.statusText,
            responseText: responseText.substring(0, 500),
            contentType: contentType,
            headers: Object.fromEntries(webhookResponse.headers.entries()),
          },
          troubleshooting: [
            "Check if SLACK_SIGNING_SECRET is correctly set",
            "Verify the webhook endpoint is functioning correctly",
            "Check server logs for detailed error information",
          ],
        }),
        { status: 500 }
      );
    }

    console.log(`[${requestId}] Webhook test completed successfully`);
    return NextResponse.json({
      success: true,
      channel: `#${channelName}`,
      message: message,
      inboxName: `slack-${channelName}`,
      webhookResponse: webhookResult,
      messageId: `test-${Date.now()}`,
      requestId,
    });
  } catch (error) {
    console.error(
      `[${requestId}] Unexpected error testing Slack webhook:`,
      error
    );
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to test Slack webhook", {
        code: "UNEXPECTED_ERROR",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack,
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify all required environment variables are set",
          "Ensure the Slack webhook endpoint is accessible",
        ],
      }),
      { status: 500 }
    );
  }
}
