"use client";

import React, { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
  applicationId?: string;
  onSuccess?: () => void;
}

export default function PlaidLinkButton({ applicationId, onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLinkToken = useCallback(async () => {
    if (!applicationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: applicationId }),
      });
      
      const data = await response.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setError("Failed to create link token");
      }
    } catch {
      setError("Failed to create link token");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    if (!applicationId) return;
    
    try {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, applicationId }),
      });
      
      onSuccess?.();
    } catch {
      setError("Failed to save connection");
    }
  }, [applicationId, onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  const handleClick = () => {
    if (linkToken && ready) {
      open();
    } else {
      createLinkToken();
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || (!ready && !!linkToken)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Loading..." : "Connect with Plaid"}
      </button>
      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
