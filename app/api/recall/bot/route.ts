import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { BadRequestError } from "@/server/errors";

const createBotSchema = z.object({
  meeting_url: z.string().url(),
  bot_name: z.string().optional(),
});

async function createBotHandler(body: unknown) {
  const { meeting_url, bot_name } = createBotSchema.parse(body);

  const recallApiKey = process.env.RECALL_API_KEY;
  if (!recallApiKey) {
    throw new BadRequestError(
      "Recall API key not configured. Please set RECALL_API_KEY environment variable."
    );
  }

  const recallApiUrl = "https://us-west-2.recall.ai/api/v1/bot/";

  const response = await fetch(recallApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${recallApiKey}`,
      accept: "application/json",
    },
    body: JSON.stringify({
      meeting_url,
      bot_name: bot_name || "Meeting Notetaker",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new BadRequestError(
      errorData.error || `Recall API error: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data;
}

export const POST = withApiWrapper(createBotHandler);
