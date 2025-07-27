import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import tsscmp from "tsscmp";
import { addInboxMessage } from "@/server";

const verifyErrorPrefix = "Failed to verify authenticity";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
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
    // Compute our own signature hash using raw body (consistent with test endpoint)
    const hmac = createHmac("sha256", slackSigningSecret);
    hmac.update(`${signatureVersion}:${slackTimestamp}:${rawBody}`);
    const ourSignatureHash = hmac.digest("hex");
    if (!signatureHash || !tsscmp(signatureHash, ourSignatureHash)) {
      throw new Error(`${verifyErrorPrefix}: signature mismatch`);
    }

    const body = JSON.parse(rawBody);

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
    console.error("Error processing Slack webhook:", error);
    return NextResponse.json(
      { error: "Failed to process Slack webhook" },
      { status: 500 }
    );
  }
}
