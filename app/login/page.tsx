"use client";
import { useRouter } from "next/navigation";
import { useCallback, Suspense } from "react";
import { setCookie } from "cookies-next";
import SearchParamError from "@/components/search-param-error";

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const token = formData.get("token");

      if (token) {
        setCookie("admin-token", token.toString());
        router.push("/admin");
      }
    },
    [router]
  );

  return (
    <div className="min-h-screen grid place-items-center p-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-md"
      >
        <input
          type="password"
          name="token"
          placeholder="Enter admin token"
          className="p-2 border rounded text-black"
          required
        />
        <button
          type="submit"
          className="bg-primary text-white p-2 rounded hover:bg-opacity-90"
        >
          Login
        </button>
        <Suspense>
          <SearchParamError />
        </Suspense>
      </form>
    </div>
  );
}
