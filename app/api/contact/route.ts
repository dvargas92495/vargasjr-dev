import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { InboxesTable, InboxMessagesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    const inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, "landing-page"))
      .limit(1)
      .execute();

    if (!inbox.length) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    await db
      .insert(InboxMessagesTable)
      .values({ source: email, body: message, inboxId: inbox[0].id });

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
