"use client";

import React from "react";

export default function SlackForm() {
  return (
    <>
      <div>
        <label htmlFor="accessToken" className="block mb-1">
          Bot Token
        </label>
        <input
          type="password"
          id="accessToken"
          name="accessToken"
          required
          placeholder="xoxb-..."
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="clientSecret" className="block mb-1">
          Signing Secret
        </label>
        <input
          type="password"
          id="clientSecret"
          name="clientSecret"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          App ID (Optional)
        </label>
        <input
          type="text"
          id="clientId"
          name="clientId"
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
