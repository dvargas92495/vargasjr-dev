"use client";

import React, { useCallback, useState } from "react";

export default function TestLambdaPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setResult(null);

      const formData = new FormData(e.currentTarget);
      const previewBranchName = formData.get("previewBranchName");
      const testSubject = formData.get("testSubject");
      const testSender = formData.get("testSender");

      try {
        const response = await fetch("/api/lambda-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            previewBranchName: previewBranchName?.toString(),
            testSubject: testSubject?.toString() || undefined,
            testSender: testSender?.toString() || undefined,
          }),
        });

        const data = await response.json();
        setResult(data);
      } catch {
        setResult({ error: "Failed to test Lambda function" });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="max-w-2xl w-full">
      <h2 className="text-xl font-bold mb-4">Test Lambda Email Processing</h2>
      <p className="text-sm text-gray-600 mb-6">
        Test the Lambda function with a preview branch by sending a simulated email.
      </p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="previewBranchName" className="block mb-1">
            Preview Branch Name *
          </label>
          <input
            type="text"
            id="previewBranchName"
            name="previewBranchName"
            required
            placeholder="feature-branch-name"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        
        <div>
          <label htmlFor="testSubject" className="block mb-1">
            Test Subject (optional)
          </label>
          <input
            type="text"
            id="testSubject"
            name="testSubject"
            placeholder="Will auto-generate with [PREVIEW: branch-name] if empty"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        
        <div>
          <label htmlFor="testSender" className="block mb-1">
            Test Sender Email (optional)
          </label>
          <input
            type="email"
            id="testSender"
            name="testSender"
            placeholder="test@example.com"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {isLoading ? "Testing..." : "Test Lambda Function"}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 border rounded">
          <h3 className="font-semibold mb-2">Test Result:</h3>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
