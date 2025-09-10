"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { updateContact } from "@/app/actions";

interface Contact {
  id: string;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: string;
}

export default function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContact = async () => {
      try {
        const { id } = await params;
        const response = await fetch(`/api/contacts/${id}`);
        if (response.ok) {
          const data = await response.json();
          setContact(data);
        } else {
          setError("Failed to load contact");
        }
      } catch {
        setError("Failed to load contact");
      } finally {
        setLoading(false);
      }
    };

    loadContact();
  }, [params]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!contact) return;

      setSaving(true);
      setError(null);

      try {
        const formData = new FormData(e.currentTarget);
        await updateContact(contact.id, formData);
        router.push(`/admin/crm/${contact.id}`);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to update contact");
      } finally {
        setSaving(false);
      }
    },
    [contact, router]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="text-center text-red-500">Contact not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/crm/${contact.id}`}>
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h2 className="text-xl font-bold">Edit Contact</h2>
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
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              defaultValue={contact.fullName || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={contact.email || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              defaultValue={contact.phoneNumber || ""}
              className="w-full p-2 border rounded text-black"
              placeholder="Enter phone number"
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
              href={`/admin/crm/${contact.id}`}
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
