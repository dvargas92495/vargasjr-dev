import { NextResponse } from "next/server";
import { ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { NotFoundError, InvalidContactDataError } from "@/server/errors";

type ApiHandler<T = unknown> = (
  body: unknown,
  request: Request,
  context?: unknown
) => Promise<T>;

export function withApiWrapper<T = unknown>(handler: ApiHandler<T>) {
  return async (request: Request, context?: any) => {
    try {
      let body;
      try {
        body = await request.json();
      } catch (jsonError) {
        return NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }

      const result = await handler(body, request, context);
      return NextResponse.json(result);
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

      if (error instanceof InvalidContactDataError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      console.error("API handler error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
