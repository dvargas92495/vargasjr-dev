"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

// OAuth provider options
const OAUTH_PROVIDERS = ["Google", "GitHub", "Custom"] as const;
type OAuthProvider = typeof OAUTH_PROVIDERS[number];

interface OAuthConfig {
  enabled: boolean;
  provider: OAuthProvider;
  redirectUris: string;
  scope: string;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const [oauthEnabled, setOauthEnabled] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const clientId = formData.get("clientId");
      const clientSecret = formData.get("clientSecret");
      const apiEndpoint = formData.get("apiEndpoint");
      
      // Get OAuth configuration
      const oauthConfig: OAuthConfig = {
        enabled: oauthEnabled,
        provider: (formData.get("oauthProvider") as OAuthProvider) || "Custom",
        redirectUris: formData.get("redirectUris")?.toString() || "",
        scope: formData.get("scope")?.toString() || "",
      };

      if (name) {
        const response = await fetch("/api/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.toString(),
            clientId: clientId?.toString(),
            clientSecret: clientSecret?.toString(),
            apiEndpoint: apiEndpoint?.toString(),
            oauthConfig: oauthEnabled ? oauthConfig : null,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          router.push(`/admin/applications/${data.id}`);
        }
      }
    },
    [router, oauthEnabled]
  );
  return (
    <div className="max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">New Application</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="block mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <div>
          <label htmlFor="clientId" className="block mb-1">
            Client ID
          </label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <div>
          <label htmlFor="clientSecret" className="block mb-1">
            Client Secret
          </label>
          <input
            type="password"
            id="clientSecret"
            name="clientSecret"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <div>
          <label htmlFor="apiEndpoint" className="block mb-1">
            API Endpoint
          </label>
          <input
            type="url"
            id="apiEndpoint"
            name="apiEndpoint"
            placeholder="https://api.example.com"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        {/* OAuth Configuration Section */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-semibold">OAuth Configuration</h3>
            <div className="ml-auto flex items-center">
              <label htmlFor="oauthEnabled" className="mr-2 text-sm">
                Enable OAuth
              </label>
              <input
                type="checkbox"
                id="oauthEnabled"
                checked={oauthEnabled}
                onChange={(e) => setOauthEnabled(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>

          {oauthEnabled && (
            <div className="space-y-4">
              <div>
                <label htmlFor="oauthProvider" className="block mb-1">
                  OAuth Provider
                </label>
                <select
                  id="oauthProvider"
                  name="oauthProvider"
                  className="w-full p-2 border rounded text-black"
                >
                  {OAUTH_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="redirectUris" className="block mb-1">
                  Redirect URIs
                </label>
                <textarea
                  id="redirectUris"
                  name="redirectUris"
                  placeholder="https://example.com/callback"
                  className="w-full p-2 border rounded text-black"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter one URI per line
                </p>
              </div>
              <div>
                <label htmlFor="scope" className="block mb-1">
                  Scope
                </label>
                <input
                  type="text"
                  id="scope"
                  name="scope"
                  placeholder="email profile"
                  className="w-full p-2 border rounded text-black"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Space-separated list of scopes
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 mt-4"
        >
          Create Application
        </button>
      </form>
    </div>
  );
}
