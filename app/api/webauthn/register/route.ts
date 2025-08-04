import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";

const registerSchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      attestationObject: z.string(),
      clientDataJSON: z.string(),
    }),
    type: z.literal("public-key"),
  }),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("admin-token");
    
    if (!adminToken || adminToken.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized. Valid admin token required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credential } = registerSchema.parse(body);

    const credentialData = {
      id: credential.id,
      rawId: credential.rawId,
      attestationObject: credential.response.attestationObject,
      clientDataJSON: credential.response.clientDataJSON,
      registeredAt: new Date().toISOString(),
    };

    const response = NextResponse.json({ 
      success: true,
      message: "Face ID credential registered successfully" 
    });
    
    response.cookies.set("webauthn-credential", JSON.stringify(credentialData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid credential data",
          validationErrors: error.errors 
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
