import { NextResponse } from "next/server";
import { VellumClient } from 'vellum-ai';
import { createErrorResponse } from "@/utils/error-response";

export async function GET() {
  const requestId = `vellum-deployments-${Date.now()}`;
  console.log(`[${requestId}] Fetching Vellum workflow deployments`);
  
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    
    if (!apiKey) {
      console.error(`[${requestId}] VELLUM_API_KEY environment variable is missing`);
      return NextResponse.json(
        createErrorResponse("Vellum API key not configured", {
          code: "MISSING_API_KEY",
          details: "VELLUM_API_KEY environment variable is required",
          requestId,
          troubleshooting: [
            "Set the VELLUM_API_KEY environment variable",
            "Verify the API key is valid and has the required permissions",
            "Check environment configuration"
          ]
        }),
        { status: 500 }
      );
    }

    let vellumClient;
    try {
      vellumClient = new VellumClient({
        apiKey: apiKey,
      });
    } catch (clientError) {
      console.error(`[${requestId}] Failed to create Vellum client:`, clientError);
      return NextResponse.json(
        createErrorResponse("Failed to initialize Vellum client", {
          code: "CLIENT_INIT_ERROR",
          details: clientError instanceof Error ? clientError.message : "Unknown client initialization error",
          requestId,
          troubleshooting: [
            "Verify the Vellum API key format is correct",
            "Check if the vellum-ai package is properly installed",
            "Ensure network connectivity to Vellum services"
          ]
        }),
        { status: 500 }
      );
    }

    let response;
    try {
      response = await vellumClient.workflowDeployments.list();
    } catch (apiError) {
      console.error(`[${requestId}] Vellum API error:`, apiError);
      
      let errorResponse;
      if (apiError instanceof Error) {
        if (apiError.message.includes('401') || apiError.message.includes('Unauthorized')) {
          errorResponse = createErrorResponse("Vellum API authentication failed", {
            code: "VELLUM_AUTH_ERROR",
            details: "Invalid or expired API key",
            requestId,
            diagnostics: {
              apiError: apiError.message,
              service: "Vellum"
            },
            troubleshooting: [
              "Verify the VELLUM_API_KEY is correct and active",
              "Check if the API key has the required permissions",
              "Generate a new API key if the current one is expired"
            ]
          });
        } else if (apiError.message.includes('429') || apiError.message.includes('rate limit')) {
          errorResponse = createErrorResponse("Vellum API rate limit exceeded", {
            code: "VELLUM_RATE_LIMIT",
            details: "Too many requests to Vellum API",
            requestId,
            diagnostics: {
              apiError: apiError.message,
              service: "Vellum"
            },
            troubleshooting: [
              "Wait before making another request",
              "Check your API usage limits",
              "Consider implementing request throttling"
            ]
          });
        } else if (apiError.message.includes('500') || apiError.message.includes('502') || apiError.message.includes('503')) {
          errorResponse = createErrorResponse("Vellum API server error", {
            code: "VELLUM_SERVER_ERROR",
            details: "Vellum service is experiencing issues",
            requestId,
            diagnostics: {
              apiError: apiError.message,
              service: "Vellum"
            },
            troubleshooting: [
              "Try the request again in a few minutes",
              "Check Vellum service status",
              "Contact Vellum support if the issue persists"
            ]
          });
        } else {
          errorResponse = createErrorResponse("Vellum API request failed", {
            code: "VELLUM_API_ERROR",
            details: apiError.message,
            requestId,
            diagnostics: {
              errorName: apiError.name,
              apiError: apiError.message,
              service: "Vellum",
              stack: apiError.stack
            },
            troubleshooting: [
              "Check network connectivity to Vellum services",
              "Verify API endpoint availability",
              "Review Vellum API documentation for changes"
            ]
          });
        }
      } else {
        errorResponse = createErrorResponse("Unknown Vellum API error", {
          code: "VELLUM_UNKNOWN_ERROR",
          details: String(apiError),
          requestId,
          troubleshooting: [
            "Check server logs for more details",
            "Verify Vellum service status"
          ]
        });
      }

      return NextResponse.json(errorResponse, { status: 500 });
    }

    console.log(`[${requestId}] Successfully fetched ${response.results?.length || 0} workflow deployments`);
    return NextResponse.json(response.results || []);
  } catch (error) {
    console.error(`[${requestId}] Unexpected error fetching workflow deployments:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to fetch workflow deployments", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : String(error),
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify all required environment variables are set",
          "Ensure network connectivity to Vellum services"
        ]
      }),
      { status: 500 }
    );
  }
}
