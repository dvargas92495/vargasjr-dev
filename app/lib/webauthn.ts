import crypto from "crypto";
import { getBaseUrl } from "@/app/api/constants";

/** @public */
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

/** @public */
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

/** @public */
export function getRpId(clientOrigin?: string): {
  rpId: string;
  debugInfo: string;
} {
  if (clientOrigin) {
    try {
      const url = new URL(clientOrigin);
      const hostname = url.hostname;
      return {
        rpId: hostname,
        debugInfo: `Provided client origin: ${clientOrigin}, Extracted hostname: ${hostname}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        rpId: "localhost",
        debugInfo: `Failed to parse provided client origin: ${clientOrigin}, Error: ${errorMsg}`,
      };
    }
  }

  if (typeof window !== "undefined" && window.location) {
    try {
      const origin = window.location.origin;
      const url = new URL(origin);
      const hostname = url.hostname;
      return {
        rpId: hostname,
        debugInfo: `Client origin: ${origin}, Extracted hostname: ${hostname}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        rpId: "localhost",
        debugInfo: `Failed to parse client origin: ${window.location.origin}, Error: ${errorMsg}`,
      };
    }
  }

  const baseUrl = getBaseUrl();
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    return {
      rpId: hostname,
      debugInfo: `Server Base URL: ${baseUrl}, Extracted hostname: ${hostname}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      rpId: "localhost",
      debugInfo: `Failed to parse server base URL: ${baseUrl}, Error: ${errorMsg}`,
    };
  }
}

/** @public */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** @public */
export function generateRegistrationOptions(
  userId: string,
  clientOrigin?: string
): PublicKeyCredentialCreationOptionsJSON {
  const { rpId } = getRpId(clientOrigin);
  return {
    rp: {
      name: "VargasJR Admin",
      id: rpId,
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

/** @public */
export function generateAuthenticationOptions(
  credentialIds: string[],
  clientOrigin?: string
): PublicKeyCredentialRequestOptionsJSON {
  const { rpId } = getRpId(clientOrigin);
  return {
    challenge: generateChallenge(),
    timeout: 60000,
    rpId: rpId,
    allowCredentials: credentialIds.map((id) => ({
      type: "public-key",
      id,
    })),
    userVerification: "required",
  };
}

/** @public */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

/** @public */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Buffer.from(base64, "base64").buffer;
}
