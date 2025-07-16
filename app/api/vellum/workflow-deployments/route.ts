import { NextResponse } from "next/server";
import { VellumClient } from 'vellum-ai';

export async function GET() {
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VELLUM_API_KEY environment variable is required" },
        { status: 500 }
      );
    }

    const vellumClient = new VellumClient({
      apiKey: apiKey,
    });

    const response = await vellumClient.workflowDeployments.list();
    
    return NextResponse.json(response.results || []);
  } catch (error) {
    console.error("Failed to fetch workflow deployments:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch workflow deployments", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
