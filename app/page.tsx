"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function Home() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          body: JSON.stringify({
            email: formData.get("email"),
            message: formData.get("message"),
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          router.push("/thank-you");
        }
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    },
    [router]
  );
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center">
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent">
          Meet Vargas JR
        </h1>
        <p>
          A fully automated senior-level software developer available for hire
          at a fraction of the cost of a full-time employee.
        </p>
        <form
          className="flex flex-col gap-4 w-full max-w-md text-black"
          onSubmit={handleSubmit}
        >
          <input
            type="email"
            placeholder="Your Email"
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-primary"
            required
          />
          <textarea
            placeholder="Tell me about your project..."
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-primary min-h-[120px]"
            required
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-secondary to-primary text-gray-100 py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            Let&apos;s Talk!
          </button>
        </form>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://github.com/dvargas92495/vargasjr-dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Repo
        </a>
      </footer>
    </div>
  );
}
