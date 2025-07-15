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
        <Link href="/login" className="relative w-32 h-32 mb-4 hover:cursor-pointer hover:opacity-90 transition-opacity">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </Link>
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
          style={{ color: '#666' }}
          href="https://github.com/dvargas92495/vargasjr-dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <g clipPath="url(#a)">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="currentColor"/>
            </g>
            <defs>
              <clipPath id="a">
                <path fill="#fff" d="M0 0h16v16H0z"/>
              </clipPath>
            </defs>
          </svg>
          Repo
        </a>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          style={{ color: '#666' }}
          href="/how-to-work-with-me"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 2C3.44772 2 3 2.44772 3 3V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V3C13 2.44772 12.5523 2 12 2H4ZM5 4H11V12H5V4ZM6 6H10V7H6V6ZM6 8H10V9H6V8ZM6 10H9V11H6V10Z" fill="currentColor"/>
          </svg>
          How to Work With Me
        </Link>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          style={{ color: '#666' }}
          href="/how-i-handle-your-data"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M8 1L3 3V7C3 10.55 5.84 13.74 9 14C12.16 13.74 15 10.55 15 7V3L8 1ZM8 2.18L13 3.82V7C13 9.92 10.84 12.44 8 12.82C5.16 12.44 3 9.92 3 7V3.82L8 2.18ZM7 5V9H9V5H7Z" fill="currentColor"/>
          </svg>
          How I Handle Your Data
        </Link>
      </footer>
    </div>
  );
}
