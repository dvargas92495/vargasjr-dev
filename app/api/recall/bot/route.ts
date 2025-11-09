import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { BadRequestError } from "@/server/errors";
import { getDb } from "@/db/connection";
import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const createBotSchema = z.object({
  meeting_url: z.string().url(),
});

async function createBotHandler(body: unknown) {
  const { meeting_url } = createBotSchema.parse(body);

  const db = getDb();
  const [recallApp] = await db
    .select()
    .from(ApplicationsTable)
    .where(eq(ApplicationsTable.name, "Recall"))
    .limit(1);

  if (!recallApp || !recallApp.clientSecret) {
    throw new BadRequestError(
      "Recall application not configured. Please add Recall application with API key in the applications table."
    );
  }

  const recallApiKey = recallApp.clientSecret;
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
      bot_name: "Vargas Jr",
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
