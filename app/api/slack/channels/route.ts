import { NextResponse } from "next/server";
import { createErrorResponse } from "@/utils/error-response";

export async function GET() {
  const requestId = `slack-channels-${Date.now()}`;
  
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
            "Check your environment configuration",
            "Ensure the token has proper scopes"
          ]
        }),
        { status: 500 }
      );
    }

    const response = await fetch("https://slack.com/api/conversations.list", {
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

    const channels = data.channels.map((channel: { id: string; name: string; is_private?: boolean }) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private || false,
      unreadCount: 0
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error(`[${requestId}] Error fetching Slack channels:`, error);
    return NextResponse.json(
      createErrorResponse("Failed to fetch Slack channels", {
        code: "FETCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
        requestId,
        troubleshooting: [
          "Check SLACK_BOT_TOKEN is valid",
          "Verify bot has channels:read scope",
          "Check network connectivity"
        ]
      }),
      { status: 500 }
    );
  }
}
