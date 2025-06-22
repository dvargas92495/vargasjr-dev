"use client";

import React from "react";

export default function RoamResearchForm() {
  return (
    <>
      <div>
        <label htmlFor="accessToken" className="block mb-1">
          API Token
        </label>
        <input
          type="password"
          id="accessToken"
          name="accessToken"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          Database Name
        </label>
        <input
          type="text"
          id="clientId"
          name="clientId"
          required
          placeholder="my-roam-database"
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="clientSecret" className="block mb-1">
          Graph URL (Optional)
        </label>
        <input
          type="text"
          id="clientSecret"
          name="clientSecret"
          placeholder="https://roamresearch.com/#/app/..."
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
