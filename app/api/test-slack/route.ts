import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createHmac } from "node:crypto";
import { createErrorResponse, createNetworkErrorResponse } from "@/utils/error-response";
import formatZodError from "@/utils/format-zod-error";

const testRequestSchema = z.object({
  channel: z.string().min(1),
  message: z.string().min(1)
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
      validatedData = testRequestSchema.parse(body);
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
              "Ensure 'channel' field is a non-empty string",
              "Ensure 'message' field is a non-empty string",
              "Check the request payload structure"
            ]
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { channel, message } = validatedData;
    const channelName = channel.startsWith("#") ? channel.slice(1) : channel;
    
    console.log(`[${requestId}] Creating test event for channel: ${channelName}`);
    
    const slackEvent = {
      type: "event_callback",
      event: {
        type: "message",
        text: message,
        user: "test-user",
        channel: channelName,
        ts: Date.now() / 1000
      }
    };

    const eventBody = JSON.stringify(slackEvent);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    let signature;
    try {
      const testSecret = "test-slack-secret";
      const signatureVersion = "v0";
      const hmac = createHmac("sha256", testSecret);
      hmac.update(`${signatureVersion}:${timestamp}:${eventBody}`);
      signature = `${signatureVersion}=${hmac.digest("hex")}`;
    } catch (signatureError) {
      console.error(`[${requestId}] Failed to generate signature:`, signatureError);
      return NextResponse.json(
        createErrorResponse("Failed to generate webhook signature", {
          code: "SIGNATURE_ERROR",
          details: signatureError instanceof Error ? signatureError.message : "Unknown signature error",
          requestId,
          troubleshooting: [
            "Check if crypto module is available",
            "Verify signature generation logic"
          ]
        }),
        { status: 500 }
      );
    }

    const webhookUrl = `${request.url.split('/api/')[0]}/api/slack`;
    console.log(`[${requestId}] Sending webhook request to: ${webhookUrl}`);

    let webhookResponse;
    try {
      webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slack-request-timestamp": timestamp,
          "x-slack-signature": signature
        },
        body: eventBody
      });
    } catch (networkError) {
      console.error(`[${requestId}] Network error calling webhook:`, networkError);
      return NextResponse.json(
        createNetworkErrorResponse(
          "Failed to call Slack webhook endpoint",
          undefined,
          undefined,
          webhookUrl
        ),
        { status: 500 }
      );
    }

    let webhookResult;
    try {
      webhookResult = await webhookResponse.json();
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse webhook response:`, parseError);
      const responseText = await webhookResponse.text().catch(() => "Unable to read response");
      return NextResponse.json(
        createErrorResponse("Failed to parse webhook response", {
          code: "RESPONSE_PARSE_ERROR",
          details: parseError instanceof Error ? parseError.message : "Invalid JSON response",
          requestId,
          diagnostics: {
            statusCode: webhookResponse.status,
            statusText: webhookResponse.statusText,
            responseText: responseText.substring(0, 500),
            headers: Object.fromEntries(webhookResponse.headers.entries())
          },
          troubleshooting: [
            "Check if the webhook endpoint returns valid JSON",
            "Verify the webhook endpoint is functioning correctly"
          ]
        }),
        { status: 500 }
      );
    }

    if (!webhookResponse.ok) {
      console.error(`[${requestId}] Webhook returned error status:`, webhookResponse.status, webhookResult);
      const errorResponse = createNetworkErrorResponse(
        "Slack webhook returned error status",
        webhookResponse.status,
        JSON.stringify(webhookResult),
        webhookUrl
      );
      console.log(`[${requestId}] Returning detailed error response:`, JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 500 });
    }

    console.log(`[${requestId}] Webhook test completed successfully`);
    return NextResponse.json({ 
      success: true, 
      channel: `#${channelName}`,
      message: message,
      inboxName: `slack-${channelName}`,
      webhookResponse: webhookResult,
      messageId: `test-${Date.now()}`,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Unexpected error testing Slack webhook:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }
    
    return NextResponse.json(
      createErrorResponse("Failed to test Slack webhook", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify all required environment variables are set",
          "Ensure the Slack webhook endpoint is accessible"
        ]
      }),
      { status: 500 }
    );
  }
}
