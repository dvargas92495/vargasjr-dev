"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface ApprovePRButtonProps {
  prNumber: string;
}

const ApprovePRButton = ({ prNumber }: ApprovePRButtonProps) => {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [message, setMessage] = useState("");

  const approvePR = async () => {
    setIsApproving(true);
    setMessage("");
    
    try {
      const response = await fetch("/api/github/approve-pr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prNumber }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setMessage("PR approved successfully!");
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch {
      setMessage("Failed to approve PR");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={approvePR}
        disabled={isApproving}
        className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
      >
        {isApproving ? "Approving..." : "Approve"}
      </button>
      {message && (
        <span className={`text-xs ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </span>
      )}
    </div>
  );
};

export default ApprovePRButton;
