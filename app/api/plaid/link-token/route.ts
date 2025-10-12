import { z } from "zod";
import { getDb } from "@/db/connection";
import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withApiWrapper } from "@/utils/api-wrapper";

const linkTokenSchema = z.object({
  userId: z.string(),
});

async function linkTokenHandler(body: unknown) {
  const { userId } = linkTokenSchema.parse(body);

  const db = getDb();
  const [capitalOneApp] = await db
    .select()
    .from(ApplicationsTable)
    .where(eq(ApplicationsTable.name, "Family Capital One Account"))
    .limit(1);

  if (
    !capitalOneApp ||
    !capitalOneApp.clientId ||
    !capitalOneApp.clientSecret
  ) {
    throw new Error("Capital One application credentials not found");
  }

  const plaidClientId = capitalOneApp.clientId;
  const plaidSecret = capitalOneApp.clientSecret;
  const plaidEnv = process.env.PLAID_ENV || "sandbox";

  const response = await fetch(
    `https://${plaidEnv}.plaid.com/link/token/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        client_name: "Vargas JR",
        country_codes: ["US"],
        language: "en",
        user: { client_user_id: userId },
        products: ["transactions"],
      }),
    }
  );

  const data = await response.json();
  return { link_token: data.link_token };
}

export const POST = withApiWrapper(linkTokenHandler);
