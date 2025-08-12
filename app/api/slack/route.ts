import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import tsscmp from "tsscmp";
import { addInboxMessage, resolveSlackUser, resolveSlackChannel } from "@/server";
import { createErrorResponse } from "@/utils/error-response";
import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export async function POST(request: Request) {
  const requestId = `slack-webhook-${Date.now()}`;
  
  try {
    const rawBody = await request.text();
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (!slackSigningSecret) {
      console.error(`[${requestId}] SLACK_SIGNING_SECRET environment variable is not set`);
      return NextResponse.json(
        createErrorResponse("Missing Slack signing secret", {
          code: "MISSING_SECRET",
          details: "SLACK_SIGNING_SECRET environment variable is required for webhook processing",
          requestId,
          troubleshooting: [
            "Set SLACK_SIGNING_SECRET environment variable in your deployment",
            "Check your environment configuration",
            "Ensure the secret matches your Slack app configuration"
          ]
        }),
        { status: 500 }
      );
    }

    const slackTimestamp = request.headers.get("x-slack-request-timestamp");
    const slackSignature = request.headers.get("x-slack-signature");

    if (!slackSignature) {
      console.error(`[${requestId}] Missing x-slack-signature header`);
      return NextResponse.json(
        createErrorResponse("Missing signature header", {
          code: "MISSING_SIGNATURE",
          details: "x-slack-signature header is required for webhook verification",
          requestId,
          troubleshooting: [
            "Ensure the request includes x-slack-signature header",
            "Check if the request is coming from Slack",
            "Verify webhook configuration in Slack app settings"
          ]
        }),
        { status: 400 }
      );
    }

    if (!slackTimestamp || Number.isNaN(Number(slackTimestamp))) {
      console.error(`[${requestId}] Invalid x-slack-request-timestamp header: ${slackTimestamp}`);
      return NextResponse.json(
        createErrorResponse("Invalid timestamp header", {
          code: "INVALID_TIMESTAMP",
          details: `x-slack-request-timestamp header must be a valid number, got: ${slackTimestamp}`,
          requestId,
          troubleshooting: [
            "Ensure the request includes valid x-slack-request-timestamp header",
            "Check if the request is coming from Slack",
            "Verify the timestamp is a Unix timestamp in seconds"
          ]
        }),
        { status: 400 }
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
      console.error(`[${requestId}] Request is stale: timestamp ${slackTimestamp} is older than ${requestTimestampMaxDeltaMin} minutes`);
      return NextResponse.json(
        createErrorResponse("Request timestamp is stale", {
          code: "STALE_REQUEST",
          details: `Request timestamp must be within ${requestTimestampMaxDeltaMin} minutes of current time`,
          requestId,
          diagnostics: {
            requestTimestamp: slackTimestamp,
            currentTime: Math.floor(nowMs / 1000),
            maxAge: `${requestTimestampMaxDeltaMin} minutes`
          },
          troubleshooting: [
            "Ensure system clocks are synchronized",
            "Check if the request is being replayed",
            "Verify the webhook is being sent promptly by Slack"
          ]
        }),
        { status: 400 }
      );
    }

    // Rule 2: Check signature
    // Separate parts of signature
    const [signatureVersion, signatureHash] = slackSignature.split("=");
    // Only handle known versions
    if (signatureVersion !== "v0") {
      console.error(`[${requestId}] Unknown signature version: ${signatureVersion}`);
      return NextResponse.json(
        createErrorResponse("Unknown signature version", {
          code: "UNKNOWN_SIGNATURE_VERSION",
          details: `Only signature version 'v0' is supported, got: ${signatureVersion}`,
          requestId,
          troubleshooting: [
            "Check Slack webhook documentation for supported signature versions",
            "Verify the webhook configuration in Slack app settings"
          ]
        }),
        { status: 400 }
      );
    }
    // Compute our own signature hash using raw body (consistent with test endpoint)
    const hmac = createHmac("sha256", slackSigningSecret);
    hmac.update(`${signatureVersion}:${slackTimestamp}:${rawBody}`);
    const ourSignatureHash = hmac.digest("hex");
    if (!signatureHash || !tsscmp(signatureHash, ourSignatureHash)) {
      console.error(`[${requestId}] Signature verification failed`);
      return NextResponse.json(
        createErrorResponse("Signature verification failed", {
          code: "SIGNATURE_MISMATCH",
          details: "The request signature does not match the expected signature",
          requestId,
          troubleshooting: [
            "Verify SLACK_SIGNING_SECRET matches your Slack app configuration",
            "Check if the request body was modified in transit",
            "Ensure the signature calculation uses the raw request body"
          ]
        }),
        { status: 401 }
      );
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (jsonError) {
      console.error(`[${requestId}] Failed to parse request body as JSON:`, jsonError);
      return NextResponse.json(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details: jsonError instanceof Error ? jsonError.message : "Request body is not valid JSON",
          requestId,
          diagnostics: {
            rawBodyPreview: rawBody.substring(0, 200),
            bodyLength: rawBody.length
          },
          troubleshooting: [
            "Ensure the request body contains valid JSON",
            "Check if the request is properly formatted",
            "Verify the Content-Type header is application/json"
          ]
        }),
        { status: 400 }
      );
    }

    // Handle different types of events
    if (body.type === "url_verification") {
      // Handle Slack URL verification challenge
      return NextResponse.json({ challenge: body.challenge });
    }

    if (body.type === "event_callback") {
      const event = body.event;

      if (event.type === "message") {
        try {
          const inboxName = `slack-${event.channel}`;
          const displayLabel = await resolveSlackChannel(event.channel);
          const userDisplayName = await resolveSlackUser(event.user);
          
          const db = getDb();
          let inbox = await db
            .select({ id: InboxesTable.id })
            .from(InboxesTable)
            .where(eq(InboxesTable.name, inboxName))
            .limit(1)
            .execute();

          if (!inbox.length) {
            const newInbox = await db
              .insert(InboxesTable)
              .values({
                name: inboxName,
                displayLabel: displayLabel,
                type: "SLACK",
                config: {},
              })
              .returning({ id: InboxesTable.id });
            inbox = newInbox;
          } else {
            await db
              .update(InboxesTable)
              .set({ displayLabel: displayLabel })
              .where(eq(InboxesTable.id, inbox[0].id))
              .execute();
          }

          await addInboxMessage({
            body: event.text,
            source: userDisplayName,
            inboxName: inboxName,
            createdAt: new Date(event.ts * 1000),
          });
        } catch (dbError) {
          console.error(`[${requestId}] Database error adding inbox message:`, dbError);
          return NextResponse.json(
            createErrorResponse("Failed to save message to inbox", {
              code: "DATABASE_ERROR",
              details: dbError instanceof Error ? dbError.message : "Unknown database error",
              requestId,
              diagnostics: {
                inboxName: `slack-${event.channel}`,
                eventType: event.type,
                errorName: dbError instanceof Error ? dbError.name : "Unknown"
              },
              troubleshooting: [
                "Check if POSTGRES_URL environment variable is set",
                "Verify database connection is working",
                "Ensure the inbox exists in the database",
                "Check database logs for connection issues"
              ]
            }),
            { status: 500 }
          );
        }

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[${requestId}] Unexpected error processing Slack webhook:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }
    
    return NextResponse.json(
      createErrorResponse("Failed to process Slack webhook", {
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
          "Ensure the webhook payload is valid JSON"
        ]
      }),
      { status: 500 }
    );
  }
}
