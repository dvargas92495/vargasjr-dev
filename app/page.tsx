"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isHiring, setIsHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);

      try {
        const response = await fetch("/api/chat", {
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
          const { id } = await response.json();
          router.push(`/chat/${id}`);
        } else {
          throw new Error(await response.text());
        }
      } catch (error) {
        setError("Error creating chat session: " + error);
      }
    },
    [router]
  );

  const handleHireMe = useCallback(async () => {
    setIsHiring(true);
    setHireError(null);
    
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      setHireError("Error starting checkout: " + error);
    } finally {
      setIsHiring(false);
    }
  }, []);
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
            name="email"
            required
          />
          <textarea
            placeholder="Tell me about your project..."
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-primary min-h-[120px]"
            name="message"
            required
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-secondary to-primary text-gray-100 py-2 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            Let&apos;s Chat!
          </button>
          {error && <p className="text-red-500">{error}</p>}
        </form>
        
        <div className="w-full max-w-md">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600">Or hire me directly:</p>
          </div>
          <button
            onClick={handleHireMe}
            disabled={isHiring}
            className="w-full bg-gradient-to-r from-primary to-secondary text-gray-100 py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isHiring ? "Processing..." : "💼 Hire Me Now"}
          </button>
          {hireError && <p className="text-red-500 text-sm mt-2">{hireError}</p>}
        </div>
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
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/how-to-work-with-me"
        >
          <Image
            aria-hidden
            src="/document.svg"
            alt="Document icon"
            width={16}
            height={16}
          />
          How to Work With Me
        </Link>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/how-i-handle-your-data"
        >
          <Image
            aria-hidden
            src="/shield.svg"
            alt="Shield icon"
            width={16}
            height={16}
          />
          How I Handle Your Data
        </Link>
      </footer>
    </div>
  );
}
