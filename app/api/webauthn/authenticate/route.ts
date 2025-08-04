import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";

const authenticateSchema = z.object({
  assertion: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().nullable(),
    }),
    type: z.literal("public-key"),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assertion } = authenticateSchema.parse(body);

    const cookieStore = await cookies();
    const storedCredential = cookieStore.get("webauthn-credential");
    
    if (!storedCredential) {
      return NextResponse.json(
        { error: "No registered Face ID credential found" },
        { status: 404 }
      );
    }

    const clientData = JSON.parse(
      Buffer.from(assertion.response.clientDataJSON, "base64").toString()
    );
    
    if (clientData.type !== "webauthn.get") {
      return NextResponse.json(
        { error: "Invalid authentication type" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ 
      valid: true,
      message: "Face ID authentication successful" 
    });
    
    response.cookies.set("admin-token", process.env.ADMIN_TOKEN!, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid assertion data",
          validationErrors: error.errors 
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn authentication error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
