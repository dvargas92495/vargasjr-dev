"use client";

import React from "react";

export default function MercuryForm() {
  return (
    <>
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
    </>
  );
}
