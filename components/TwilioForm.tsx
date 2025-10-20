"use client";

import React from "react";

export default function TwilioForm() {
  return (
    <>
      <div>
        <label htmlFor="clientId" className="block mb-1">
          Account SID
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
          Auth Token
        </label>
        <input
          type="password"
          id="clientSecret"
          name="clientSecret"
          required
          className="w-full p-2 border rounded text-black"
        />
      </div>
    </>
  );
}
