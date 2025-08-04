import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const storedCredential = cookieStore.get("webauthn-credential");
    
    return NextResponse.json({
      hasRegisteredCredential: !!storedCredential,
      registeredAt: storedCredential ? 
        JSON.parse(storedCredential.value).registeredAt : null,
    });
  } catch (error) {
    console.error("WebAuthn status error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
