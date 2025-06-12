"use client";

import React from "react";

export default function TwitterForm() {
  return (
    <>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          API Key
        </label>
        <input
          type="text"
          id="clientId"
          name="clientId"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
      <div>
        <label htmlFor="clientSecret" className="block mb-1">
          API Secret
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
        <label htmlFor="accessToken" className="block mb-1">
          Access Token
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
        <label htmlFor="refreshToken" className="block mb-1">
          Refresh Token
        </label>
        <input
          type="password"
          id="refreshToken"
          name="refreshToken"
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
