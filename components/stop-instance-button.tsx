"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const StopInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopInstance = async () => {
    setPending(true);
    setError(null);
    
    try {
      const response = await fetch("/api/instances", {
        method: "POST",
        body: JSON.stringify({ id, operation: "STOP" }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to stop instance");
      }
      
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop instance");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        onClick={stopInstance}
        disabled={pending}
        className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 disabled:opacity-50"
      >
        {pending ? "Stopping..." : "Stop Instance"}
      </button>
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </>
  );
};

export default StopInstanceButton;
