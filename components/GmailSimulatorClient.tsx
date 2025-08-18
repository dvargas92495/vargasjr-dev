"use client";

import React, { useCallback, useState } from "react";

export default function GmailSimulatorClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setResult(null);

      const formData = new FormData(e.currentTarget);
      const testSubject = formData.get("testSubject");
      const testSender = formData.get("testSender");
      const testBody = formData.get("testBody");

      try {
        const response = await fetch("/api/test-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testSubject: testSubject?.toString(),
            testSender: testSender?.toString(),
            testBody: testBody?.toString(),
          }),
        });

        const data = await response.json();
        setResult(data);
      } catch {
        setResult({ error: "Failed to test email processing" });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 space-y-1">
        <div>
          <strong>Status:</strong>{" "}
          <span className="text-green-600">Connected</span>
        </div>
        <div>
          <strong>Account:</strong> vargas.jr.dev@gmail.com
        </div>
        <div>
          <strong>API Quota:</strong> 1,000,000 requests/day
        </div>
        <div>
          <strong>Last Sync:</strong> 5 minutes ago
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Test Email Processing</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="testSubject" className="block mb-1">
              Test Subject *
            </label>
            <input
              type="text"
              id="testSubject"
              name="testSubject"
              required
              placeholder="Enter test email subject"
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label htmlFor="testSender" className="block mb-1">
              Test Sender Email *
            </label>
            <input
              type="email"
              id="testSender"
              name="testSender"
              required
              placeholder="test@example.com"
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label htmlFor="testBody" className="block mb-1">
              Test Email Body *
            </label>
            <textarea
              id="testBody"
              name="testBody"
              required
              placeholder="Enter the email body content..."
              className="w-full p-2 border rounded text-black"
              rows={5}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? "Testing..." : "Test Email Processing"}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 border rounded">
            <h4 className="font-semibold mb-2">Test Result:</h4>
            <pre className="text-sm bg-gray-800 text-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2) as string}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
