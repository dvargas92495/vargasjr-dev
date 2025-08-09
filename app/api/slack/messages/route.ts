import { NextResponse } from "next/server";
import { createErrorResponse } from "@/utils/error-response";

export async function GET(request: Request) {
  const requestId = `slack-messages-${Date.now()}`;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channel');
  
  if (!channelId) {
    return NextResponse.json(
      createErrorResponse("Missing channel parameter", {
        code: "MISSING_CHANNEL",
        details: "channel query parameter is required",
        requestId,
        troubleshooting: [
          "Include ?channel=CHANNEL_ID in the request URL"
        ]
      }),
      { status: 400 }
    );
  }
  
  try {
    const slackBotToken = process.env.SLACK_BOT_TOKEN;
    if (!slackBotToken) {
      console.error(`[${requestId}] SLACK_BOT_TOKEN environment variable is not set`);
      return NextResponse.json(
        createErrorResponse("Missing Slack bot token", {
          code: "MISSING_TOKEN",
          details: "SLACK_BOT_TOKEN environment variable is required",
          requestId,
          troubleshooting: [
            "Set SLACK_BOT_TOKEN environment variable",
            "Check your environment configuration"
          ]
        }),
        { status: 500 }
      );
    }

    const response = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    const messages = data.messages.reverse().map((message: { ts: string; user?: string; text?: string }) => ({
      id: message.ts,
      user: message.user || "Unknown User",
      avatar: message.user ? message.user.substring(0, 2).toUpperCase() : "??",
      timestamp: new Date(parseFloat(message.ts) * 1000).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      content: message.text || ""
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error(`[${requestId}] Error fetching Slack messages:`, error);
    return NextResponse.json(
      createErrorResponse("Failed to fetch Slack messages", {
        code: "FETCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
        requestId,
        troubleshooting: [
          "Check SLACK_BOT_TOKEN is valid",
          "Verify bot has channels:history scope",
          "Check channel ID is correct",
          "Ensure bot is member of the channel"
        ]
      }),
      { status: 500 }
    );
  }
}
