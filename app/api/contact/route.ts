import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { addInboxMessage } from "@/server";
import { NotFoundError } from "@/server/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, message } = z
      .object({
        email: z.string().email(),
        message: z.string(),
      })
      .parse(body);

    await addInboxMessage({
      body: message,
      source: email,
      inboxName: "landing-page",
    });

    return NextResponse.json({ success: true });
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

    console.error("Failed to process contact form", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
