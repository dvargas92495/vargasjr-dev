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
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-md"
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
        <button
          type="submit"
          className="bg-primary text-white p-2 rounded hover:bg-opacity-90 disabled:opacity-50"
          disabled={isAutoLogging || isValidating}
        >
          {isAutoLogging ? "Auto-logging in..." : isValidating ? "Validating..." : "Login"}
        </button>
        
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
      </form>
    </div>
  );
}
