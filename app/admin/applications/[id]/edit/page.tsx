"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface Application {
  id: string;
  name: string;
  clientId: string | null;
  clientSecret: string | null;
  createdAt: string;
}

export default function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        const { id } = await params;
        const response = await fetch(`/api/applications/${id}`);
        if (response.ok) {
          const data = await response.json();
          setApplication(data);
        } else {
          setError("Failed to load application");
        }
      } catch {
        setError("Failed to load application");
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [params]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!application) return;

      setSaving(true);
      setError(null);

      try {
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name");
        const clientId = formData.get("clientId");
        const clientSecret = formData.get("clientSecret");

        const response = await fetch(`/api/applications/${application.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name?.toString(),
            clientId: clientId?.toString(),
            clientSecret: clientSecret?.toString(),
          }),
        });

        if (response.ok) {
          router.push(`/admin/applications/${application.id}`);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to update application");
        }
      } catch {
        setError("Failed to update application");
      } finally {
        setSaving(false);
      }
    },
    [application, router]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center text-red-500">Application not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/applications/${application.id}`}>
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h2 className="text-xl font-bold">Edit Application</h2>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={application.name}
              required
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
              Plaid Client ID
            </label>
            <input
              type="text"
              id="clientId"
              name="clientId"
              defaultValue={application.clientId || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Enter your Plaid Client ID"
            />
          </div>

          <div>
            <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
              Plaid Secret Key
            </label>
            <input
              type="password"
              id="clientSecret"
              name="clientSecret"
              defaultValue={application.clientSecret || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Enter your Plaid Secret Key"
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
              href={`/admin/applications/${application.id}`}
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
