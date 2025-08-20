import { NextResponse } from "next/server";
import { getBaseUrl } from "../constants";

export async function GET() {
  try {
    const baseUrl = getBaseUrl();
    const webhookUrl = `${baseUrl}/api/ses/webhook`;
    
    return NextResponse.json({ 
      webhookUrl,
      baseUrl,
      environment: process.env.VERCEL_ENV || "development"
    });
  } catch (error) {
    console.error("Error getting webhook URL:", error);
    return NextResponse.json(
      { error: "Failed to get webhook URL" },
      { status: 500 }
    );
  }
}
