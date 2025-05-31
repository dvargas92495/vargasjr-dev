"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OAuthConfig {
  enabled: boolean;
  provider: "Google" | "GitHub" | "Custom";
  redirectUris: string;
  scope: string;
}

interface Application {
  id: string;
  name: string;
  clientId: string | null;
  clientSecret: string | null;
  apiEndpoint: string | null;
  oauthConfig: OAuthConfig | null;
  createdAt: string;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState<string>("");
  const [selectedRedirectUri, setSelectedRedirectUri] = useState<string>("");

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const response = await fetch(`/api/applications/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch application");
        }
        const data = await response.json();
        setApplication(data);
      } catch (err) {
        setError("Error loading application details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [id]);
  useEffect(() => {
    // Set the first redirect URI as the default selected one
    if (application?.oauthConfig?.redirectUris) {
      const uris = application.oauthConfig.redirectUris.split("\n");
      if (uris.length > 0) {
        setSelectedRedirectUri(uris[0]);
      }
    }
  }, [application]);

  // Function to build the authorize URL based on the provider
  const buildAuthorizeUrl = () => {
    if (!application?.oauthConfig?.enabled || !application.clientId) {
      return;
    }

    let baseUrl = "";
    const params = new URLSearchParams();
    params.append("client_id", application.clientId);
    params.append("redirect_uri", selectedRedirectUri);
    params.append("response_type", "code");
    
    if (application.oauthConfig.scope) {
      params.append("scope", application.oauthConfig.scope);
    }

    // Set the base URL based on the provider
    switch (application.oauthConfig.provider) {
      case "Google":
        baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
        break;
      case "GitHub":
        baseUrl = "https://github.com/login/oauth/authorize";
        break;
      case "Custom":
        // For custom provider, use the API endpoint if available
        if (application.apiEndpoint) {
          baseUrl = `${application.apiEndpoint}/oauth/authorize`;
        }
        break;
    }

    if (baseUrl) {
      setAuthorizeUrl(`${baseUrl}?${params.toString()}`);
    }
  };

  if (loading) {
    return <div className="p-4">Loading application details...</div>;
  }

  if (error || !application) {
    return <div className="p-4 text-red-500">{error || "Application not found"}</div>;
  }
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{application.name}</h1>
        <Link
          href="/admin/applications"
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
        >
          Back to Applications
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Application Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="font-medium">{application.name}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Created At</p>
            <p className="font-medium">
              {new Date(application.createdAt).toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Client ID</p>
            <p className="font-medium break-all">
              {application.clientId || "Not set"}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Client Secret</p>
            <div className="flex items-center">
              <p className="font-medium break-all">
                {application.clientSecret
                  ? showSecret
                    ? application.clientSecret
                    : "••••••••••••••••"
                  : "Not set"}
              </p>
              {application.clientSecret && (
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
              )}
            </div>
          </div>
          
          <div className="col-span-2">
            <p className="text-sm text-gray-500">API Endpoint</p>
            <p className="font-medium break-all">
              {application.apiEndpoint || "Not set"}
            </p>
          </div>
        </div>
      </div>
      {/* OAuth Configuration Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">OAuth Configuration</h2>
        
        {application.oauthConfig?.enabled ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Provider</p>
              <p className="font-medium">{application.oauthConfig.provider}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Redirect URIs</p>
              <div className="bg-gray-50 p-3 rounded border">
                {application.oauthConfig.redirectUris.split("\n").map((uri, index) => (
                  <p key={index} className="font-mono text-sm break-all">
                    {uri}
                  </p>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Scope</p>
              <p className="font-medium font-mono">
                {application.oauthConfig.scope || "Not set"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">OAuth is not configured for this application.</p>
        )}
      </div>
      {/* OAuth Flow Section */}
      {application.oauthConfig?.enabled && application.clientId && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">OAuth Flow</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="redirectUri" className="block text-sm text-gray-500 mb-1">
                Select Redirect URI
              </label>
              <select
                id="redirectUri"
                value={selectedRedirectUri}
                onChange={(e) => setSelectedRedirectUri(e.target.value)}
                className="w-full p-2 border rounded text-black"
              >
                {application.oauthConfig.redirectUris.split("\n").map((uri, index) => (
                  <option key={index} value={uri}>
                    {uri}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex">
              <button
                onClick={buildAuthorizeUrl}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Generate Authorization URL
              </button>
            </div>
            
            {authorizeUrl && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Authorization URL:</p>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="font-mono text-sm break-all">{authorizeUrl}</p>
                </div>
                <div className="mt-2">
                  <a
                    href={authorizeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Open Authorization URL
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
