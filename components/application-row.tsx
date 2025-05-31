"use client";

import type { Application } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface OAuthConfig {
  enabled: boolean;
  provider: string;
  redirectUris: string;
  scope: string;
}

const ApplicationRow = ({ application }: { application: Application }) => {
  const router = useRouter();
  const handleClick = useCallback(() => {
    router.push(`/admin/applications/${application.id}`);
  }, [router, application.id]);
  
  // Parse OAuth config if it exists
  let oauthConfig: OAuthConfig | null = null;
  if (application.oauthConfig) {
    try {
      // Handle both already parsed object and string JSON
      oauthConfig = typeof application.oauthConfig === 'string' 
        ? JSON.parse(application.oauthConfig) 
        : application.oauthConfig as unknown as OAuthConfig;
    } catch (e) {
      console.error("Error parsing OAuth config", e);
    }
  }

  const isOAuthEnabled = oauthConfig?.enabled === true;
  const oauthProvider = isOAuthEnabled ? oauthConfig.provider : null;
  
  return (
    <tr
      key={application.id}
      className="hover:bg-gray-50 hover:cursor-pointer hover:text-black"
      onClick={handleClick}
    >
      <td className="px-6 py-4 border-b">{application.name}</td>
      <td className="px-6 py-4 border-b">{application.apiEndpoint || 'N/A'}</td>
      <td className="px-6 py-4 border-b">
        <span className={`px-2 py-1 rounded text-xs ${isOAuthEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {isOAuthEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </td>
      <td className="px-6 py-4 border-b">
        {oauthProvider || 'N/A'}
      </td>
      <td className="px-6 py-4 border-b">
        {application.createdAt.toLocaleDateString()}
      </td>
    </tr>
  );
};

export default ApplicationRow;
