import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { ContactFormResponsesTable } from "@/db/schema";
import { z, ZodError } from "zod";

const db = drizzle(sql);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, message } = z
      .object({
        email: z.string().email(),
        message: z.string(),
      })
      .parse(body);

    await db
      .insert(ContactFormResponsesTable)
      .values({ email, message, formId: "landing-page" });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}
