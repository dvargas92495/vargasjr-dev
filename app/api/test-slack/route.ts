import { NextResponse } from "next/server";
import { z } from "zod";
import { postSlackMessage } from "@/server/index";

const testRequestSchema = z.object({
  channel: z.string().min(1),
  message: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channel, message } = testRequestSchema.parse(body);

    const channelName = channel.startsWith("#") ? channel : `#${channel}`;
    
    const slackResponse = await postSlackMessage({
      channel: channelName,
      message: message,
    });

    return NextResponse.json({ 
      success: true, 
      channel: channelName,
      message: message,
      slackResponse: slackResponse
    });
  } catch (error) {
    console.error("Error testing Slack:", error);
    return NextResponse.json(
      { error: "Failed to test Slack function", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
