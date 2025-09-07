"use client";

import React from "react";

export default function PlaidForm() {
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
        <label htmlFor="clientSecret" className="block mb-1">
          Secret Key
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
