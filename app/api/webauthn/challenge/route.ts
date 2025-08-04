import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const challenge = randomBytes(32);
    
    return NextResponse.json({
      challenge: Buffer.from(challenge).toString("base64url"),
    });
  } catch (error) {
    console.error("Challenge generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500 }
    );
  }
}
