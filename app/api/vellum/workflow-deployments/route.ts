import { NextResponse } from "next/server";
import { VellumClient } from 'vellum-ai';

export async function GET() {
  console.log("Starting workflow deployments fetch");
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    console.log("VELLUM_API_KEY status:", apiKey ? "present" : "missing");
    
    if (!apiKey) {
      console.error("VELLUM_API_KEY environment variable is missing");
      return NextResponse.json(
        { error: "VELLUM_API_KEY environment variable is required" },
        { status: 500 }
      );
    }

    console.log("Creating VellumClient...");
    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    console.log("Calling workflowDeployments.list()...");
    const startTime = Date.now();
    const response = await vellumClient.workflowDeployments.list();
    const endTime = Date.now();
    
    console.log(`Workflow deployments API call completed in ${endTime - startTime}ms`);
    console.log("Response structure:", {
      hasResults: !!response.results,
      resultsLength: response.results?.length || 0,
      responseKeys: Object.keys(response)
    });
    
    return NextResponse.json(response.results || []);
  } catch (error) {
    console.error("Failed to fetch workflow deployments:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch workflow deployments", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
