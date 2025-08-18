import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const validateTokenSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = validateTokenSchema.parse(body);

    if (token === process.env.ADMIN_TOKEN) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          validationErrors: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Token validation failed" },
      { status: 500 }
    );
  }
}
