"use client";

import React from "react";

export default function CapitalOneForm() {
  return (
    <>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          Client ID
        </label>
        <input
          type="password"
          id="clientId"
          name="clientId"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="accessToken" className="block mb-1">
          API Key
        </label>
        <input
          type="password"
          id="accessToken"
          name="accessToken"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
