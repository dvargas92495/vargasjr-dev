"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { setCookie } from "cookies-next";
import SearchParamError from "@/components/search-param-error";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const tokenValue = formData.get("token")?.toString() || token;

      if (tokenValue) {
        localStorage.setItem("admin-token", tokenValue);
        setCookie("admin-token", tokenValue);
        router.push("/admin");
      }
    },
    [router, token]
  );

  const clearStoredToken = useCallback(() => {
    localStorage.removeItem("admin-token");
    setToken("");
    setHasStoredToken(false);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("admin-token");
    if (storedToken) {
      setToken(storedToken);
      setHasStoredToken(true);
      setIsAutoLogging(true);
      
      setCookie("admin-token", storedToken);
      router.push("/admin");
    }
  }, [router]);

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
          disabled={isAutoLogging}
        />
        <button
          type="submit"
          className="bg-primary text-white p-2 rounded hover:bg-opacity-90 disabled:opacity-50"
          disabled={isAutoLogging}
        >
          {isAutoLogging ? "Auto-logging in..." : "Login"}
        </button>
        
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
