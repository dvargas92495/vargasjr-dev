import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { ChatSessionsTable, InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "@/server/errors";

const db = drizzle(sql);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    z
      .object({
        email: z.string().email(),
        message: z.string(),
      })
      .parse(body);

    let inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, "chat-sessions"))
      .limit(1)
      .execute();

    if (!inbox.length) {
      const newInbox = await db
        .insert(InboxesTable)
        .values({
          name: "chat-sessions",
          type: "CHAT_SESSION",
          config: {},
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    const chatSession = await db
      .insert(ChatSessionsTable)
      .values({ inboxId: inbox[0].id })
      .returning({ id: ChatSessionsTable.id });

    return NextResponse.json({ id: chatSession[0].id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `Invalid request body: ${formatZodError(error)}` },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to create chat session", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
