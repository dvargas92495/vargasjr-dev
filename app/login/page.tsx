"use client";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { setCookie } from "cookies-next";
import SearchParamError from "@/components/search-param-error";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState("");
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const validateToken = useCallback(async (tokenValue: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/validate-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: tokenValue }),
      });

      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error("Token validation failed:", error);
      return false;
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const tokenValue = formData.get("token")?.toString() || token;

      if (tokenValue) {
        setIsValidating(true);
        setValidationError("");

        const isValid = await validateToken(tokenValue);
        
        if (isValid) {
          localStorage.setItem("admin-token", tokenValue);
          setCookie("admin-token", tokenValue);
          router.push("/admin");
        } else {
          setValidationError("Invalid token. Please try again.");
        }
        
        setIsValidating(false);
      }
    },
    [router, token, validateToken]
  );

  const clearStoredToken = useCallback(() => {
    localStorage.removeItem("admin-token");
    setToken("");
    setHasStoredToken(false);
    setValidationError("");
  }, []);


  const handleSetupFaceId = useCallback(async () => {
    if (!token) {
      setValidationError("Please enter your admin token first to set up Face ID");
      return;
    }

    const isValid = await validateToken(token);
    if (!isValid) {
      setValidationError("Invalid token. Please enter a valid admin token to set up Face ID");
      return;
    }

    try {
      if (!window.PublicKeyCredential) {
        setValidationError("WebAuthn is not supported in this browser");
        return;
      }

      setValidationError("Setting up Face ID...");

      const optionsResponse = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.error || "Failed to get registration options");
      }

      const options = await optionsResponse.json();

      const credential = await navigator.credentials.create({
        publicKey: options.publicKey,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Failed to create credential");
      }

      const registerResponse = await fetch("/api/webauthn/register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          credential: {
            id: credential.id,
            rawId: Array.from(new Uint8Array(credential.rawId)),
            response: {
              attestationObject: Array.from(new Uint8Array((credential.response as AuthenticatorAttestationResponse).attestationObject)),
              clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
            },
            type: credential.type,
          },
        }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        throw new Error(errorData.error || "Failed to register credential");
      }

      localStorage.setItem("webauthn-credential-id", credential.id);
      setValidationError("Face ID setup successful! You can now use biometric authentication.");
    } catch (error: unknown) {
      console.error("Face ID setup failed:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setValidationError("Face ID setup was cancelled or not allowed");
        } else if (error.name === "NotSupportedError") {
          setValidationError("Face ID is not supported on this device");
        } else {
          setValidationError(`Face ID setup failed: ${error.message}`);
        }
      } else {
        setValidationError("Face ID setup failed with an unknown error");
      }
    }
  }, [token, validateToken]);

  useEffect(() => {
    const storedToken = localStorage.getItem("admin-token");
    if (storedToken) {
      setIsAutoLogging(true);
      setToken(storedToken);
      setHasStoredToken(true);
      
      validateToken(storedToken).then((isValid) => {
        if (isValid) {
          setCookie("admin-token", storedToken);
          router.push("/admin");
        } else {
          localStorage.removeItem("admin-token");
          setToken("");
          setHasStoredToken(false);
          setValidationError("Stored token is invalid. Please login again.");
          setIsAutoLogging(false);
        }
      });
    }
  }, [router, validateToken]);

  useEffect(() => {
    if (isAutoLogging && pathname === "/admin") {
      setIsAutoLogging(false);
    }
  }, [pathname, isAutoLogging]);

  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="flex flex-col gap-4 w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input
            type="password"
            name="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter admin token"
            className="p-2 border rounded text-black"
            required
            disabled={isAutoLogging || isValidating}
          />
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={isAutoLogging || isValidating}
            >
              {isAutoLogging ? "Auto-logging in..." : isValidating ? "Validating..." : "Login"}
            </button>
            
            <button
              type="button"
              onClick={handleSetupFaceId}
              className="bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
              disabled={isAutoLogging || isValidating}
            >
              🔐 Face ID
            </button>
          </div>
        </form>
        
        {validationError && (
          <p className="text-red-500 text-sm">{validationError}</p>
        )}
        
        {hasStoredToken && (
          <button
            type="button"
            onClick={clearStoredToken}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear stored token
          </button>
        )}
        
        <Suspense>
          <SearchParamError />
        </Suspense>
      </div>
    </div>
  );
}
