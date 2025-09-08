"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function NewApplicationPage() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const clientId = formData.get("clientId");
      const clientSecret = formData.get("clientSecret");

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
        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 cursor-pointer"
        >
          Create Application
        </button>
      </form>
    </div>
  );
}
