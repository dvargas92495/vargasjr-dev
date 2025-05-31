import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { ApplicationsTable } from "@/db/schema";
import { z, ZodError } from "zod";

const db = drizzle(sql);

// Define OAuth config schema
const oauthConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["Google", "GitHub", "Custom"]),
  redirectUris: z.string(),
  scope: z.string(),
}).nullable();

const applicationSchema = z.object({
  name: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  apiEndpoint: z.string().optional(),
  oauthConfig: oauthConfigSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, clientId, clientSecret, apiEndpoint, oauthConfig } = applicationSchema.parse(body);

    // Store the application with the OAuth configuration
    const [application] = await db
      .insert(ApplicationsTable)
      .values({ 
        name, 
        clientId, 
        clientSecret, 
        apiEndpoint,
        oauthConfig: oauthConfig ? JSON.stringify(oauthConfig) : null
      })
      .returning({ id: ApplicationsTable.id });

    return NextResponse.json({ id: application.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
}
