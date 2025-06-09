import { NextResponse } from "next/server";
import { InboxesTable } from "@/db/schema";
import { z, ZodError } from "zod";
import { InboxTypes } from "@/db/constants";
import { getDb } from "@/db/connection";

const db = getDb();

const inboxSchema = z.object({
  name: z.string(),
  type: z.enum(InboxTypes),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type } = inboxSchema.parse(body);

    const [inbox] = await db
      .insert(InboxesTable)
      .values({ name, type, config: {} })
      .returning({ id: InboxesTable.id });

    return NextResponse.json({ id: inbox.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create inbox" },
      { status: 500 }
    );
  }
}
