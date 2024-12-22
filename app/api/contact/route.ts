import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const db = drizzle(sql);

export const ContactFormResponsesTable = pgTable("contact_form_responses", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, message } = body;

    await db.insert(ContactFormResponsesTable).values({ email, message });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}
