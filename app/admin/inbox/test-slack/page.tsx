"use client";

import React, { useCallback, useState } from "react";

export default function TestSlackPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setResult(null);

      const formData = new FormData(e.currentTarget);
      const channel = formData.get("channel");
      const message = formData.get("message");

      try {
        const response = await fetch("/api/test-slack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: channel?.toString(),
            message: message?.toString(),
          }),
        });

        const data = await response.json();
        setResult(data);
      } catch {
        setResult({ error: "Failed to test Slack function" });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="max-w-2xl w-full">
      <h2 className="text-xl font-bold mb-4">Test Slack Message</h2>
      <p className="text-sm text-gray-600 mb-6">
        Test the Slack webhook by sending a message to a specified channel.
      </p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="channel" className="block mb-1">
            Slack Channel *
          </label>
          <input
            type="text"
            id="channel"
            name="channel"
            required
            placeholder="sales-alert"
            defaultValue="sales-alert"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        
        <div>
          <label htmlFor="message" className="block mb-1">
            Test Message *
          </label>
          <textarea
            id="message"
            name="message"
            required
            placeholder="Test message from VargasJR admin panel"
            defaultValue="🧪 Test message from VargasJR admin panel - Slack integration is working!"
            rows={4}
            className="w-full p-2 border rounded text-black"
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send Test Message"}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 border rounded">
          <h3 className="font-semibold mb-2">Test Result:</h3>
          <pre className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(result, null, 2) as string}
          </pre>
        </div>
      )}
    </div>
  );
}
