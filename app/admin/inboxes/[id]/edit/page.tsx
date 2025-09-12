"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { InboxTypes } from "@/db/constants";

interface Inbox {
  id: string;
  name: string;
  displayLabel: string | null;
  type: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export default function EditInboxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInbox = async () => {
      try {
        const { id } = await params;
        const response = await fetch(`/api/inboxes/${id}`);
        if (response.ok) {
          const data = await response.json();
          setInbox(data);
        } else {
          setError("Failed to load inbox");
        }
      } catch {
        setError("Failed to load inbox");
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
  }, [params]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!inbox) return;

      setSaving(true);
      setError(null);

      try {
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name");
        const displayLabel = formData.get("displayLabel");
        const type = formData.get("type");
        const configText = formData.get("config");

        let config;
        try {
          config = configText ? JSON.parse(configText.toString()) : {};
        } catch {
          setError("Invalid JSON in config field");
          setSaving(false);
          return;
        }

        const response = await fetch(`/api/inboxes/${inbox.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name?.toString(),
            displayLabel: displayLabel?.toString() || null,
            type: type?.toString(),
            config,
          }),
        });

        if (response.ok) {
          router.push(`/admin/inboxes/${inbox.id}`);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to update inbox");
        }
      } catch {
        setError("Failed to update inbox");
      } finally {
        setSaving(false);
      }
    },
    [inbox, router]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!inbox) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center text-red-500">Inbox not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/inboxes/${inbox.id}`}>
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h2 className="text-xl font-bold">Edit Inbox</h2>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={inbox.name}
              required
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label
              htmlFor="displayLabel"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Display Label
            </label>
            <input
              type="text"
              id="displayLabel"
              name="displayLabel"
              defaultValue={inbox.displayLabel || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Optional display label"
            />
          </div>

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={inbox.type}
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

          <div>
            <label
              htmlFor="config"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Configuration (JSON)
            </label>
            <textarea
              id="config"
              name="config"
              defaultValue={JSON.stringify(inbox.config, null, 2)}
              rows={6}
              className="w-full p-2 border rounded text-black font-mono text-sm"
              placeholder="{}"
            />
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/admin/inboxes/${inbox.id}`}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
