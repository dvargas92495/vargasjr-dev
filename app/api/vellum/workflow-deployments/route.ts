import { NextResponse } from "next/server";
import { VellumClient } from 'vellum-ai';

export async function GET() {
  try {
    const apiKey = process.env.VELLUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vellum API key not configured" },
        { status: 500 }
      );
    }

    const vellum = new VellumClient({ apiKey });
    const response = await vellum.workflowDeployments.list();
    const deployments = response.results || [];

    return NextResponse.json({ 
      deployments: deployments.map(d => ({
        id: d.id,
        name: d.name,
        label: d.label,
        status: d.status,
      }))
    });
  } catch (error) {
    console.error("Failed to fetch workflow deployments", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
