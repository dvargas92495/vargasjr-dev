import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Simple health check failed:", error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
