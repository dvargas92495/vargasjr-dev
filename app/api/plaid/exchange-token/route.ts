import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { ApplicationWorkspacesTable, ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const exchangeTokenSchema = z.object({
  publicToken: z.string(),
  applicationId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { publicToken, applicationId } = exchangeTokenSchema.parse(body);

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
      return NextResponse.json(
        { error: "Capital One application credentials not found" },
        { status: 500 }
      );
    }

    const plaidClientId = capitalOneApp.clientId;
    const plaidSecret = capitalOneApp.clientSecret;
    const plaidEnv = process.env.PLAID_ENV || "sandbox";

    const response = await fetch(
      `https://${plaidEnv}.plaid.com/item/public_token/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          public_token: publicToken,
        }),
      }
    );

    const data = await response.json();

    if (data.access_token) {
      await db.insert(ApplicationWorkspacesTable).values({
        applicationId,
        name: "Capital One Plaid Connection",
        accessToken: data.access_token,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
