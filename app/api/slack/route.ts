import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import tsscmp from "tsscmp";
import { addInboxMessage } from "@/server";
import { createErrorResponse } from "@/utils/error-response";

const verifyErrorPrefix = "Failed to verify authenticity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (!slackSigningSecret) {
      throw new Error(`${verifyErrorPrefix}: SLACK_SIGNING_SECRET is not set`);
    }

    const slackTimestamp = request.headers.get("x-slack-request-timestamp");
    const slackSignature = request.headers.get("x-slack-signature");

    if (!slackSignature) {
      throw new Error(
        `${verifyErrorPrefix}: header x-slack-signature is required`
      );
    }

    if (Number.isNaN(slackTimestamp)) {
      throw new Error(
        `${verifyErrorPrefix}: header x-slack-request-timestamp did not have the expected type (${slackTimestamp})`
      );
    }

    // Calculate time-dependent values
    const nowMs = Date.now();
    const requestTimestampMaxDeltaMin = 5;
    const fiveMinutesAgoSec =
      Math.floor(nowMs / 1000) - 60 * requestTimestampMaxDeltaMin;

    // Enforce verification rules

    // Rule 1: Check staleness
    if (Number(slackTimestamp) < fiveMinutesAgoSec) {
      throw new Error(
        `${verifyErrorPrefix}: x-slack-request-timestamp must differ from system time by no more than ${requestTimestampMaxDeltaMin} minutes or request is stale`
      );
    }

    // Rule 2: Check signature
    // Separate parts of signature
    const [signatureVersion, signatureHash] = slackSignature.split("=");
    // Only handle known versions
    if (signatureVersion !== "v0") {
      throw new Error(`${verifyErrorPrefix}: unknown signature version`);
    }
    // Compute our own signature hash
    const hmac = createHmac("sha256", slackSigningSecret);
    hmac.update(`${signatureVersion}:${slackTimestamp}:${body}`);
    const ourSignatureHash = hmac.digest("hex");
    if (!signatureHash || !tsscmp(signatureHash, ourSignatureHash)) {
      throw new Error(`${verifyErrorPrefix}: signature mismatch`);
    }

    // Handle different types of events
    if (body.type === "url_verification") {
      // Handle Slack URL verification challenge
      return NextResponse.json({ challenge: body.challenge });
    }

    if (body.type === "event_callback") {
      const event = body.event;

      if (event.type === "message") {
        await addInboxMessage({
          body: event.text,
          source: event.user,
          inboxName: `slack-${event.channel}`,
          createdAt: new Date(event.ts * 1000),
        });

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const requestId = `slack-webhook-${Date.now()}`;
    console.error(`[${requestId}] Error processing Slack webhook:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    let errorResponse;
    if (error instanceof Error && error.message.startsWith(verifyErrorPrefix)) {
      errorResponse = createErrorResponse("Slack webhook verification failed", {
        code: "VERIFICATION_FAILED",
        details: error.message,
        requestId,
        diagnostics: {
          errorType: "signature_verification",
          timestamp: new Date().toISOString()
        },
        troubleshooting: [
          "Verify SLACK_SIGNING_SECRET environment variable is correct",
          "Check that request headers include x-slack-signature and x-slack-request-timestamp",
          "Ensure request is not older than 5 minutes",
          "Verify the request body matches what Slack sent"
        ]
      });
    } else {
      errorResponse = createErrorResponse("Failed to process Slack webhook", {
        code: "PROCESSING_ERROR",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify database connectivity",
          "Ensure inbox configuration is correct"
        ]
      });
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
