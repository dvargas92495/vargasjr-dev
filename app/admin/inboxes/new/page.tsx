"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { InboxTypes } from "@/db/constants";

export default function NewInboxPage() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const type = formData.get("type");

      if (name && type) {
        const response = await fetch("/api/inboxes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.toString(),
            type: type.toString(),
            config: {}, // Default empty config
          }),
        });

        if (response.ok) {
          const data = await response.json();
          router.push(`/admin/inboxes/${data.id}`);
        }
      }
    },
    [router]
  );

  return (
    <div className="max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">New Inbox</h2>
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
          <label htmlFor="type" className="block mb-1">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            className="w-full p-2 border rounded text-black"
          >
            <option value="">Select a type...</option>
            {InboxTypes.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
        >
          Create Inbox
        </button>
      </form>
    </div>
  );
}
