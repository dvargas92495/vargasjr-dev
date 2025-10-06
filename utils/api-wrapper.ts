import { NextResponse } from "next/server";
import { ZodError } from "zod";
import formatZodError from "@/components/format-zod-error";
import {
  NotFoundError,
  InvalidContactDataError,
  InvalidContactFormatError,
  UnauthorizedError,
} from "@/server/errors";

type ApiHandler<T = unknown> = (body: unknown) => Promise<T>;
type GetBodyFunction = (request: Request) => Promise<unknown>;

export function withApiWrapper<T = unknown>(
  handler: ApiHandler<T>,
  options?: { getBody?: GetBodyFunction }
) {
  return async (request: Request, context?: any) => {
    try {
      let body;
      if (request.method === "GET") {
        body = null;
      } else if (options?.getBody) {
        body = await options.getBody(request);
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

      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
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
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 }
      );
    }
  };
}
