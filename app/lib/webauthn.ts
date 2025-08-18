import crypto from "crypto";

export interface PublicKeyCredentialCreationOptionsJSON {
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  challenge: string;
  pubKeyCredParams: Array<{
    type: "public-key";
    alg: number;
  }>;
  timeout: number;
  attestation: "direct" | "indirect" | "none";
  authenticatorSelection: {
    authenticatorAttachment?: "platform" | "cross-platform";
    userVerification?: "required" | "preferred" | "discouraged";
    requireResidentKey?: boolean;
  };
}

export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: Array<{
    type: "public-key";
    id: string;
  }>;
  userVerification: "required" | "preferred" | "discouraged";
}

export function generateChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateRegistrationOptions(
  userId: string
): PublicKeyCredentialCreationOptionsJSON {
  return {
    rp: {
      name: "VargasJR Admin",
      id: "localhost",
    },
    user: {
      id: userId,
      name: "admin",
      displayName: "Admin User",
    },
    challenge: generateChallenge(),
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      requireResidentKey: false,
    },
  };
}

export function generateAuthenticationOptions(
  credentialIds: string[]
): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: generateChallenge(),
    timeout: 60000,
    rpId: "localhost",
    allowCredentials: credentialIds.map((id) => ({
      type: "public-key",
      id,
    })),
    userVerification: "required",
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Buffer.from(base64, "base64").buffer;
}
