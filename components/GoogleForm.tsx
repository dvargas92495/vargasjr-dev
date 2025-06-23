"use client";

import React from "react";

export default function GoogleForm() {
  return (
    <>
      <div>
        <label htmlFor="clientSecret" className="block mb-1">
          Service Account JSON
        </label>
        <textarea
          id="clientSecret"
          name="clientSecret"
          required
          rows={8}
          placeholder='{"type": "service_account", "project_id": "...", ...}'
          className="w-full p-2 border rounded text-black font-mono text-sm"
        />
        <p className="text-sm text-gray-600 mt-1">
          Paste the entire JSON content from your Google Cloud service account key file
        </p>
      </div>
    </>
  );
}
