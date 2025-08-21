import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db/connection";
import { WebAuthnCredentialsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAuthenticationOptions } from "@/app/lib/webauthn";

const authOptionsSchema = z.object({
  token: z.string().min(1),
  origin: z.string().url().optional(),
});

const authCredentialSchema = z.object({
  token: z.string().min(1),
  credential: z.object({
    id: z.string(),
    rawId: z.array(z.number()),
    response: z.object({
      authenticatorData: z.array(z.number()),
      clientDataJSON: z.array(z.number()),
      signature: z.array(z.number()),
    }),
    type: z.literal("public-key"),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, origin } = authOptionsSchema.parse(body);

    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const credentials = await db
      .select({ credentialId: WebAuthnCredentialsTable.credentialId })
      .from(WebAuthnCredentialsTable)
      .where(eq(WebAuthnCredentialsTable.userId, "admin"));

    const credentialIds = credentials.map((c: { credentialId: string }) => c.credentialId);
    const options = generateAuthenticationOptions(credentialIds, origin);
    return NextResponse.json({
      publicKey: {
        ...options,
        challenge: Array.from(Buffer.from(options.challenge, "base64url")),
        allowCredentials: options.allowCredentials.map((cred) => ({
          ...cred,
          id: Array.from(Buffer.from(cred.id, "base64url")),
        })),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          validationErrors: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn authentication options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { token, credential } = authCredentialSchema.parse(body);

    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const storedCredential = await db
      .select()
      .from(WebAuthnCredentialsTable)
      .where(eq(WebAuthnCredentialsTable.credentialId, credential.id))
      .limit(1);

    if (storedCredential.length === 0) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          validationErrors: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("WebAuthn authentication error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate credential" },
      { status: 500 }
    );
  }
}
