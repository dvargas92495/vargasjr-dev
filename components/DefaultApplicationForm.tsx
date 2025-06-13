"use client";

import React from "react";

export default function DefaultApplicationForm() {
  return (
    <>
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
    </>
  );
}
