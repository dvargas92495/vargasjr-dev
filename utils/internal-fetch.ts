import { NextRequest, NextResponse } from "next/server";

interface InternalFetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function internalFetch(
  url: string,
  options: InternalFetchOptions
): Promise<Response> {
  const { method, headers = {}, body } = options;

  if (method !== "POST") {
    throw new Error("internalFetch currently only supports POST method");
  }

  const urlObj = new URL(url);
  const apiPath = urlObj.pathname;

  const routeModules: Record<string, () => Promise<any>> = {
    "/api/slack": () => import("../app/api/slack/route"),
  };

  const moduleLoader = routeModules[apiPath];
  if (!moduleLoader) {
    throw new Error(`No internal route handler found for path: ${apiPath}`);
  }

  try {
    const routeModule = await moduleLoader();

    if (!routeModule.POST) {
      throw new Error(`No POST handler found for path: ${apiPath}`);
    }

    const request = new NextRequest(url, {
      method,
      headers: new Headers(headers),
      body,
    });

    const response = await routeModule.POST(request);

    if (response instanceof NextResponse) {
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  } catch (error) {
    console.error("Error in internalFetch:", error);
    throw error;
  }
}
