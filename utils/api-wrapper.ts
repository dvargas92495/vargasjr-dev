import { NextResponse } from "next/server";
import { ZodError } from "zod";
import formatZodError from "@/components/format-zod-error";
import {
  NotFoundError,
  InvalidContactDataError,
  InvalidContactFormatError,
} from "@/server/errors";

type ApiHandler<T = unknown> = (body: unknown) => Promise<T>;

export function withApiWrapper<T = unknown>(handler: ApiHandler<T>) {
  return async (request: Request, context?: any) => {
    try {
      let body;
      if (request.method === "GET") {
        body = null;
      } else {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/x-www-form-urlencoded")) {
          try {
            const formData = await request.formData();
            const formObject: Record<string, string> = {};
            for (const [key, value] of formData.entries()) {
              formObject[key] = value.toString();
            }
            body = formObject;
          } catch (formError) {
            return NextResponse.json(
              { error: "Invalid form data in request body" },
              { status: 400 }
            );
          }
        } else {
          try {
            body = await request.json();
          } catch (jsonError) {
            return NextResponse.json(
              { error: "Invalid JSON in request body" },
              { status: 400 }
            );
          }
        }
      }

      if (context && context.params) {
        const params = await context.params;
        body = { ...body, ...params };
      }

      const result = await handler(body);
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

      if (error instanceof InvalidContactFormatError) {
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
