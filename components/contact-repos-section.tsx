"use client";

import { useState, useEffect, useCallback } from "react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

interface ContactRepo {
  id: string;
  repoOwner: string;
  repoName: string;
  createdAt: string;
}

interface ContactReposSectionProps {
  contactId: string;
}

export default function ContactReposSection({
  contactId,
}: ContactReposSectionProps) {
  const [repos, setRepos] = useState<ContactRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRepos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contacts/${contactId}/repos`);
      if (!response.ok) {
        throw new Error("Failed to fetch repos");
      }
      const data = await response.json();
      setRepos(data.repos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repos");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoOwner.trim() || !repoName.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/contacts/${contactId}/repos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoOwner: repoOwner.trim(),
          repoName: repoName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to link repo");
      }

      setRepoOwner("");
      setRepoName("");
      setShowAddForm(false);
      await fetchRepos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to link repo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRepo = async (repoId: string) => {
    if (!confirm("Are you sure you want to unlink this repo?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/contacts/${contactId}/repos?repoId=${repoId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to unlink repo");
      }

      await fetchRepos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unlink repo");
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Connected Repositories</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Connected Repositories</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Link Repo
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddRepo} className="mb-4 p-4 bg-gray-50 rounded">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository Owner
              </label>
              <input
                type="text"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                placeholder="e.g., dvargas92495"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="e.g., vargasjr-dev"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {submitting ? "Linking..." : "Link Repository"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setRepoOwner("");
                setRepoName("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {repos.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          No repositories linked to this contact yet.
        </p>
      ) : (
        <div className="space-y-2">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
            >
              <div className="flex-1">
                <a
                  href={`https://github.com/${repo.repoOwner}/${repo.repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {repo.repoOwner}/{repo.repoName}
                </a>
                <p className="text-xs text-gray-500 mt-1">
                  Linked on {new Date(repo.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDeleteRepo(repo.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
                title="Unlink repository"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
