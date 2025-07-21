import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac } from "node:crypto";

const testRequestSchema = z.object({
  channel: z.string().min(1),
  message: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channel, message } = testRequestSchema.parse(body);

    const channelName = channel.startsWith("#") ? channel.slice(1) : channel;
    
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
    
    const testSecret = "test-slack-secret";
    const signatureVersion = "v0";
    const hmac = createHmac("sha256", testSecret);
    hmac.update(`${signatureVersion}:${timestamp}:${eventBody}`);
    const signature = `${signatureVersion}=${hmac.digest("hex")}`;

    const webhookResponse = await fetch(`${request.url.split('/api/')[0]}/api/slack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature
      },
      body: eventBody
    });

    const webhookResult = await webhookResponse.json();

    return NextResponse.json({ 
      success: true, 
      channel: `#${channelName}`,
      message: message,
      inboxName: `slack-${channelName}`,
      webhookResponse: webhookResult,
      messageId: `test-${Date.now()}`
    });
  } catch (error) {
    console.error("Error testing Slack webhook:", error);
    return NextResponse.json(
      { error: "Failed to test Slack webhook", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
