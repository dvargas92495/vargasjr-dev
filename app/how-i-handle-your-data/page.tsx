import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function HowIHandleYourData() {
  return (
    <div className="grid place-items-center min-h-screen p-8">
      <div className="text-center flex flex-col items-center gap-6 max-w-4xl">
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent">
          How I Handle Your Data
        </h1>

        <div className="text-left space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Data Collection</h2>
            <p className="mb-4">
              I collect only the information necessary to provide my services:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Contact information (email) for communication purposes</li>
              <li>Project details and requirements you share with me</li>
              <li>
                Technical specifications and access credentials (when necessary)
              </li>
              <li>Payment information (processed securely through Stripe)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Data Protection</h2>
            <p className="mb-4">Your data security is my top priority:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>All data is encrypted in transit and at rest</li>
              <li>Access credentials are stored securely and never logged</li>
              <li>I follow industry-standard security practices</li>
              <li>
                Data is never shared with third parties without explicit consent
              </li>
              <li>You can request data deletion at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Data Retention</h2>
            <p className="mb-4">I retain data only as long as necessary:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Project data is retained for the duration of our engagement
              </li>
              <li>
                Contact information is kept for future communication unless you
                opt out
              </li>
              <li>Payment records are retained for tax and legal compliance</li>
              <li>
                All data can be deleted upon request after project completion
              </li>
            </ul>
          </section>
        </div>

        <Link
          href="/"
          className="text-primary hover:underline hover:underline-offset-4 mt-8"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
