import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const linkTokenSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = linkTokenSchema.parse(body);

    const db = getDb();
    const [capitalOneApp] = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.name, "Family Capital One Account"))
      .limit(1);
    
    if (!capitalOneApp || !capitalOneApp.clientId || !capitalOneApp.clientSecret) {
      return NextResponse.json(
        { error: "Capital One application credentials not found" },
        { status: 500 }
      );
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
    return NextResponse.json({ link_token: data.link_token });
  } catch {
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
