import { NextResponse } from "next/server";
import { createErrorResponse } from "@/utils/error-response";

export async function GET() {
  const requestId = `slack-channels-${Date.now()}`;

  try {
    const slackBotToken = process.env.SLACK_BOT_TOKEN;
    if (!slackBotToken) {
      console.error(
        `[${requestId}] SLACK_BOT_TOKEN environment variable is not set`
      );
      return NextResponse.json(
        createErrorResponse("Missing Slack bot token", {
          code: "MISSING_TOKEN",
          details: "SLACK_BOT_TOKEN environment variable is required",
          requestId,
          troubleshooting: [
            "Set SLACK_BOT_TOKEN environment variable",
            "Check your environment configuration",
            "Ensure the token has proper scopes",
          ],
        }),
        { status: 500 }
      );
    }

    const response = await fetch("https://slack.com/api/conversations.list", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      console.error(`[${requestId}] Slack API returned error:`, {
        error: data.error,
        warning: data.warning,
        response_metadata: data.response_metadata,
        full_response: data,
      });
      throw new Error(
        `Slack API error: ${data.error}${
          data.warning ? ` (Warning: ${data.warning})` : ""
        }`
      );
    }

    const channels = data.channels.map(
      (channel: { id: string; name: string; is_private?: boolean }) => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private || false,
        unreadCount: 0,
      })
    );

    return NextResponse.json({ channels });
  } catch (error) {
    console.error(`[${requestId}] Error fetching Slack channels:`, error);

    const errorDetails =
      error instanceof Error ? error.message : "Unknown error";
    const troubleshooting = [
      "Check SLACK_BOT_TOKEN is valid",
      "Verify bot has channels:read scope",
      "Check network connectivity",
    ];

    if (error instanceof Error) {
      if (error.message.includes("invalid_auth")) {
        troubleshooting.unshift("SLACK_BOT_TOKEN is invalid or expired");
      } else if (error.message.includes("missing_scope")) {
        troubleshooting.unshift("Bot needs 'channels:read' scope permission");
      } else if (error.message.includes("account_inactive")) {
        troubleshooting.unshift("Slack workspace or bot account is inactive");
      }
    }

    return NextResponse.json(
      createErrorResponse("Failed to fetch Slack channels", {
        code: "FETCH_ERROR",
        details: errorDetails,
        requestId,
        troubleshooting,
        diagnostics: {
          timestamp: new Date().toISOString(),
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
          slackTokenPresent: !!process.env.SLACK_BOT_TOKEN,
          slackTokenLength: process.env.SLACK_BOT_TOKEN?.length || 0,
        },
      }),
      { status: 500 }
    );
  }
}
