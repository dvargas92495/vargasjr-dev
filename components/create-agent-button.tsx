"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const CreateAgentButton = () => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  const createAgent = async () => {
    setIsCreating(true);
    setMessage("");
    
    try {
      const response = await fetch("/api/create-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setMessage(result.message);
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch {
      setMessage("Failed to start agent creation");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <button
        onClick={createAgent}
        disabled={isCreating}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isCreating ? "Creating Agent..." : "Create Agent"}
      </button>
      {message && (
        <p className={`mt-2 text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default CreateAgentButton;
