import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../db/connection";
import { ApplicationWorkspacesTable } from "../../../../db/schema";

const exchangeTokenSchema = z.object({
  publicToken: z.string(),
  applicationId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { publicToken, applicationId } = exchangeTokenSchema.parse(body);
    
    const plaidClientId = process.env.PLAID_CLIENT_ID;
    const plaidSecret = process.env.PLAID_SECRET;
    const plaidEnv = process.env.PLAID_ENV || "sandbox";
    
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 500 }
      );
    }
    
    const response = await fetch(`https://${plaidEnv}.plaid.com/item/public_token/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        public_token: publicToken,
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      const db = getDb();
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
