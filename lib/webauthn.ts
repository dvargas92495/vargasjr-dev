export interface WebAuthnCredential {
  id: string;
  rawId: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
  type: "public-key";
}

export interface WebAuthnAssertion {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle: string | null;
  };
  type: "public-key";
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && 
         "credentials" in navigator && 
         "create" in navigator.credentials;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function generateChallenge(): Promise<string> {
  const response = await fetch("/api/webauthn/challenge");
  if (!response.ok) {
    throw new Error("Failed to generate challenge");
  }
  const data = await response.json();
  return data.challenge;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function registerCredential(): Promise<WebAuthnCredential> {
  const challenge = await generateChallenge();
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToBuffer(challenge),
      rp: {
        name: "VargasJR",
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode("admin"),
        name: "admin",
        displayName: "Admin User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: "direct",
    },
  }) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Failed to create credential");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    response: {
      attestationObject: bufferToBase64url(response.attestationObject),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
    },
    type: "public-key",
  };
}

export async function authenticateWithCredential(): Promise<WebAuthnAssertion> {
  const challenge = await generateChallenge();
  
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(challenge),
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  if (!assertion) {
    throw new Error("Failed to authenticate");
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  
  return {
    id: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    response: {
      authenticatorData: bufferToBase64url(response.authenticatorData),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
    type: "public-key",
  };
}

export async function registerWebAuthnCredential(credential: WebAuthnCredential): Promise<void> {
  const response = await fetch("/api/webauthn/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Registration failed");
  }
}

export async function authenticateWebAuthn(assertion: WebAuthnAssertion): Promise<void> {
  const response = await fetch("/api/webauthn/authenticate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assertion }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Authentication failed");
  }
}

export async function getWebAuthnStatus(): Promise<{ hasRegisteredCredential: boolean; registeredAt: string | null }> {
  const response = await fetch("/api/webauthn/status");
  if (!response.ok) {
    throw new Error("Failed to check WebAuthn status");
  }
  return response.json();
}
