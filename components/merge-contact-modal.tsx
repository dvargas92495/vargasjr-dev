"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import type { Contact } from "@/db/schema";

export interface MergeContactModalHandle {
  openModal: () => void;
  closeModal: () => void;
}

interface MergeContactModalProps {
  currentContactId: string;
  currentContactName: string;
  onMerge: (targetContactId: string) => Promise<void>;
}

const MergeContactModal = forwardRef<
  MergeContactModalHandle,
  MergeContactModalProps
>(({ currentContactId, currentContactName, onMerge }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = useCallback(() => {
    setIsOpen(true);
    setSearchQuery("");
    setContacts([]);
    setSelectedContactId(null);
    setError(null);
    setLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setError(null);
    setLoading(false);
    setSearchLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({
    openModal,
    closeModal,
  }));

  const searchContacts = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setContacts([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(
            query
          )}&exclude=${currentContactId}`
        );
        if (!response.ok) {
          throw new Error("Failed to search contacts");
        }
        const searchResults = await response.json();
        setContacts(searchResults);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to search contacts"
        );
      } finally {
        setSearchLoading(false);
      }
    },
    [currentContactId]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContacts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchContacts]);

  const handleMerge = useCallback(async () => {
    if (!selectedContactId) {
      setError("Please select a contact to merge");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onMerge(selectedContactId);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge contacts");
    } finally {
      setLoading(false);
    }
  }, [selectedContactId, onMerge, closeModal]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Merge Contact
              </h3>
              <div className="mt-4 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This action cannot be undone. All
                    messages and chat sessions from the selected contact will be
                    transferred to &quot;{currentContactName}&quot;, and the
                    selected contact will be deleted.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search for contact to merge into &quot;{currentContactName}
                    &quot;
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                {searchLoading && (
                  <div className="text-center py-4">
                    <div className="text-sm text-gray-500">Searching...</div>
                  </div>
                )}

                {contacts.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Select
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {contacts.map((contact) => (
                          <tr
                            key={contact.id}
                            className={`hover:bg-gray-50 cursor-pointer ${
                              selectedContactId === contact.id
                                ? "bg-blue-50"
                                : ""
                            }`}
                            onClick={() => setSelectedContactId(contact.id)}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="radio"
                                checked={selectedContactId === contact.id}
                                onChange={() =>
                                  setSelectedContactId(contact.id)
                                }
                                className="text-blue-600"
                              />
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {contact.fullName || "N/A"}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {contact.email || "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {searchQuery && !searchLoading && contacts.length === 0 && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No contacts found matching &quot;{searchQuery}&quot;
                  </div>
                )}

                {selectedContact && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Selected:</strong>{" "}
                      {selectedContact.fullName || "Unnamed Contact"} (
                      {selectedContact.email || "No email"})
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      This contact&apos;s messages and chat sessions will be
                      transferred to &quot;{currentContactName}&quot;, and this
                      contact will be deleted.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleMerge}
              disabled={loading || !selectedContactId}
            >
              {loading ? "Merging..." : "Merge Contacts"}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={closeModal}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

MergeContactModal.displayName = "MergeContactModal";

export default MergeContactModal;
