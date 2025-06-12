"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AppTypes, AppType } from "@/db/constants";
import TwitterForm from "@/components/TwitterForm";
import DefaultApplicationForm from "@/components/DefaultApplicationForm";

export default function NewApplicationPage() {
  const router = useRouter();
  const [selectedAppType, setSelectedAppType] = useState<AppType | "">("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const appType = formData.get("appType");
      const clientId = formData.get("clientId");
      const clientSecret = formData.get("clientSecret");
      const apiEndpoint = formData.get("apiEndpoint");
      const accessToken = formData.get("accessToken");
      const refreshToken = formData.get("refreshToken");

      if (name && appType) {
        const response = await fetch("/api/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.toString(),
            appType: appType.toString(),
            clientId: clientId?.toString(),
            clientSecret: clientSecret?.toString(),
            apiEndpoint: apiEndpoint?.toString(),
            accessToken: accessToken?.toString(),
            refreshToken: refreshToken?.toString(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          router.push(`/admin/applications/${data.id}`);
        }
      }
    },
    [router]
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
          <label htmlFor="appType" className="block mb-1">
            Application Type
          </label>
          <select
            id="appType"
            name="appType"
            required
            value={selectedAppType}
            onChange={(e) => setSelectedAppType(e.target.value as AppType | "")}
            className="w-full p-2 border rounded text-black"
          >
            <option value="">Select an application type...</option>
            {AppTypes.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {(() => {
          switch (selectedAppType) {
            case "TWITTER":
              return <TwitterForm />;
            case "NOTION":
            case "DEVIN":
            default:
              return selectedAppType ? <DefaultApplicationForm /> : null;
          }
        })()}

        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
          disabled={!selectedAppType}
        >
          Create Application
        </button>
      </form>
    </div>
  );
}
