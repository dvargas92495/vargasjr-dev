import { NextResponse } from "next/server";
import { z } from "zod";

const linkTokenSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = linkTokenSchema.parse(body);
    
    const plaidClientId = process.env.PLAID_CLIENT_ID;
    const plaidSecret = process.env.PLAID_SECRET;
    const plaidEnv = process.env.PLAID_ENV || "sandbox";
    
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 500 }
      );
    }
    
    const response = await fetch(`https://${plaidEnv}.plaid.com/link/token/create`, {
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
    });
    
    const data = await response.json();
    return NextResponse.json({ link_token: data.link_token });
  } catch {
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
