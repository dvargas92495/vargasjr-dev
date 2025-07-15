"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function NewRoutineJobPage() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name");
      const cronExpression = formData.get("cronExpression");

      if (name && cronExpression) {
        console.log("Creating routine job:", { name, cronExpression });
        
        router.push("/admin/jobs");
      }
    },
    [router]
  );

  return (
    <div className="max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">New Routine Job</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="block mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <div>
          <label htmlFor="cronExpression" className="block mb-1">
            Cron Expression
          </label>
          <input
            type="text"
            id="cronExpression"
            name="cronExpression"
            required
            placeholder="e.g., 0 9 * * 1-5"
            className="w-full p-2 border rounded text-black"
          />
        </div>
        <button
          type="submit"
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
        >
          Create Routine Job
        </button>
      </form>
    </div>
  );
}
