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
          Graph Name
        </label>
        <input
          type="text"
          id="clientId"
          name="clientId"
          required
          placeholder="my-roam-graph"
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
