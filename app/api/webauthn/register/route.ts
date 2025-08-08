import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db/connection";
import { WebAuthnCredentialsTable } from "@/db/schema";
import { generateRegistrationOptions } from "@/app/lib/webauthn";

const registerOptionsSchema = z.object({
  token: z.string().min(1),
});

const registerCredentialSchema = z.object({
  token: z.string().min(1),
  credential: z.object({
    id: z.string(),
    rawId: z.array(z.number()),
    response: z.object({
      attestationObject: z.array(z.number()),
      clientDataJSON: z.array(z.number()),
    }),
    type: z.literal("public-key"),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = registerOptionsSchema.parse(body);

    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = generateRegistrationOptions("admin");
    
    return NextResponse.json({
      publicKey: {
        ...options,
        challenge: Array.from(Buffer.from(options.challenge, "base64url")),
        user: {
          ...options.user,
          id: Array.from(Buffer.from(options.user.id)),
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          validationErrors: error.errors 
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn registration options error:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { token, credential } = registerCredentialSchema.parse(body);

    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    const publicKeyBuffer = Buffer.from(credential.response.attestationObject);
    const publicKeyBase64 = publicKeyBuffer.toString("base64");

    await db.insert(WebAuthnCredentialsTable).values({
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      counter: 0,
      userId: "admin",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          validationErrors: error.errors 
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn registration error:", error);
    return NextResponse.json(
      { error: "Failed to register credential" },
      { status: 500 }
    );
  }
}
