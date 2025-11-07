import { withApiWrapper } from "@/utils/api-wrapper";

async function getSlackChannelsHandler() {
  const requestId = `slack-channels-${Date.now()}`;

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (!slackBotToken) {
    console.error(
      `[${requestId}] SLACK_BOT_TOKEN environment variable is not set`
    );
    throw new Error("SLACK_BOT_TOKEN environment variable is required");
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

  return { channels };
}

export const GET = withApiWrapper(getSlackChannelsHandler);
