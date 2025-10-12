"use client";

import React from "react";
import PlaidLinkButton from "./PlaidLinkButton";

interface CapitalOneFormProps {
  applicationId?: string;
}

export default function CapitalOneForm({ applicationId }: CapitalOneFormProps) {
  return (
    <>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          Client ID
        </label>
        <input
          type="password"
          id="clientId"
          name="clientId"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="accessToken" className="block mb-1">
          API Key
        </label>
        <input
          type="password"
          id="accessToken"
          name="accessToken"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>

      {applicationId && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2">Connect Your Capital One Account</h4>
          <p className="text-sm text-gray-600 mb-2">
            Connect your Capital One account to enable automatic transaction
            syncing.
          </p>
          <PlaidLinkButton applicationId={applicationId} />
        </div>
      )}
    </>
  );
}
