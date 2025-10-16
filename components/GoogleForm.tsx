"use client";

import React from "react";

interface GoogleFormProps {
  applicationId?: string;
}

export default function GoogleForm({ applicationId }: GoogleFormProps) {
  const handleOAuthConnect = () => {
    if (!applicationId) {
      alert("Please save the application first before connecting OAuth");
      return;
    }

    const clientId = (document.getElementById("clientId") as HTMLInputElement)?.value;
    const clientSecret = (document.getElementById("clientSecret") as HTMLInputElement)?.value;

    if (!clientId || !clientSecret) {
      alert("Please enter Client ID and Client Secret first");
      return;
    }

    const redirectUri = `${window.location.origin}/api/google/oauth/callback`;
    const scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(applicationId)}`;

    window.open(authUrl, "_blank", "width=600,height=700");
  };

  return (
    <>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          Client ID
        </label>
        <input
          type="text"
          id="clientId"
          name="clientId"
          required
          placeholder="xxxxx.apps.googleusercontent.com"
          className="w-full p-2 border rounded text-black"
        />
        <p className="text-sm text-gray-600 mt-1">
          OAuth 2.0 Client ID from Google Cloud Console
        </p>
      </div>
      <div>
        <label htmlFor="clientSecret" className="block mb-1">
          Client Secret
        </label>
        <input
          type="password"
          id="clientSecret"
          name="clientSecret"
          required
          className="w-full p-2 border rounded text-black"
        />
        <p className="text-sm text-gray-600 mt-1">
          OAuth 2.0 Client Secret from Google Cloud Console
        </p>
      </div>
      {applicationId && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2">Connect Your Gmail Account</h4>
          <p className="text-sm text-gray-600 mb-2">
            Click below to authorize access to your Gmail account via OAuth 2.0
          </p>
          <button
            type="button"
            onClick={handleOAuthConnect}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Connect Gmail Account
          </button>
        </div>
      )}
    </>
  );
}
