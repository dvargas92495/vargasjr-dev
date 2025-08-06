"use client";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { setCookie } from "cookies-next";
import SearchParamError from "@/components/search-param-error";
import { useWebAuthn } from "../../hooks/useWebAuthn";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState("");
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  
  const webauthn = useWebAuthn();

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
          
          if (webauthn.status.isSupported && 
              webauthn.status.isBiometricAvailable && 
              !webauthn.status.hasRegisteredCredential) {
            setShowRegistrationPrompt(true);
          } else {
            router.push("/admin");
          }
        } else {
          setValidationError("Invalid token. Please try again.");
        }
        
        setIsValidating(false);
      }
    },
    [router, token, validateToken, webauthn.status.isSupported, webauthn.status.isBiometricAvailable, webauthn.status.hasRegisteredCredential]
  );

  const clearStoredToken = useCallback(() => {
    localStorage.removeItem("admin-token");
    setToken("");
    setHasStoredToken(false);
    setValidationError("");
  }, []);

  const handleFaceIdAuth = useCallback(async () => {
    if (!webauthn.status.hasRegisteredCredential) return;
    
    webauthn.clearError();
    const success = await webauthn.authenticate();
    
    if (success) {
      router.push("/admin");
    }
  }, [webauthn, router]);

  const handleRegisterFaceId = useCallback(async () => {
    webauthn.clearError();
    const success = await webauthn.register();
    
    if (success) {
      setShowRegistrationPrompt(false);
      router.push("/admin");
    }
  }, [webauthn, router]);

  const skipRegistration = useCallback(() => {
    setShowRegistrationPrompt(false);
    router.push("/admin");
  }, [router]);

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

  if (showRegistrationPrompt) {
    return (
      <div className="min-h-screen grid place-items-center p-8">
        <div className="flex flex-col gap-4 w-full max-w-md text-center">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Set up Face ID</h2>
            <p className="text-gray-600 text-sm">
              Enable Face ID for faster and more secure login to your admin panel.
            </p>
          </div>
          
          <button
            onClick={handleRegisterFaceId}
            disabled={webauthn.isRegistering}
            className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {webauthn.isRegistering && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {webauthn.isRegistering ? "Setting up Face ID..." : "Enable Face ID"}
          </button>
          
          <button
            onClick={skipRegistration}
            className="text-gray-500 hover:text-gray-700 underline text-sm"
          >
            Skip for now
          </button>
          
          {webauthn.error && (
            <p className="text-red-500 text-sm">{webauthn.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="flex flex-col gap-4 w-full max-w-md">
        {webauthn.status.isSupported && 
         webauthn.status.isBiometricAvailable && 
         webauthn.status.hasRegisteredCredential && (
          <div className="mb-4">
            <button
              onClick={handleFaceIdAuth}
              disabled={webauthn.isAuthenticating || isAutoLogging}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white p-3 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {webauthn.isAuthenticating && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {webauthn.isAuthenticating ? "Authenticating..." : "🔐 Sign in with Face ID"}
            </button>
            
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-gray-500 text-sm">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
          </div>
        )}
        
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs text-gray-700">
          <div className="font-semibold mb-2">WebAuthn Debug Status:</div>
          <div>isSupported: {String(webauthn.status.isSupported)}</div>
          <div>isBiometricAvailable: {String(webauthn.status.isBiometricAvailable)}</div>
          <div>hasRegisteredCredential: {String(webauthn.status.hasRegisteredCredential)}</div>
          <div>registeredAt: {webauthn.status.registeredAt || 'null'}</div>
          <div>isLoading: {String(webauthn.isLoading)}</div>
          <div>error: {webauthn.error || 'null'}</div>
        </div>
        
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
            disabled={isAutoLogging || isValidating || webauthn.isAuthenticating}
          />
          <button
            type="submit"
            className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 disabled:opacity-50"
            disabled={isAutoLogging || isValidating || webauthn.isAuthenticating}
          >
            {isAutoLogging ? "Auto-logging in..." : isValidating ? "Validating..." : "Login with Token"}
          </button>
        </form>
        
        {(validationError || webauthn.error) && (
          <p className="text-red-500 text-sm">{validationError || webauthn.error}</p>
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
