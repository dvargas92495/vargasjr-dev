import Image from "next/image";
import Link from "next/link";

export default function ThankYou() {
  return (
    <div className="grid place-items-center min-h-screen">
      <div className="text-center flex flex-col items-center gap-6">
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4">Thank You!</h1>
        <p>I&apos;ll be in touch with you soon.</p>
        <Link 
          href="/" 
          className="text-primary hover:underline hover:underline-offset-4"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
} 