"use client";

import React from "react";
import Link from "next/link";

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
}

interface RoutineJobRowProps {
  job: RoutineJob;
}

export default function RoutineJobRow({ job }: RoutineJobRowProps) {
  return (
    <tr key={job.id}>
      <td className="px-6 py-4 border-b">{job.name}</td>
      <td className="px-6 py-4 border-b">{job.cronExpression}</td>
      <td className="px-6 py-4 border-b">
        {job.enabled ? (
          <span className="text-green-600 font-semibold">✓ Enabled</span>
        ) : (
          <span className="text-red-600 font-semibold">✗ Disabled</span>
        )}
      </td>
      <td className="px-6 py-4 border-b">
        <Link
          href={`/admin/jobs/routine/${job.id}`}
          className="text-blue-600 hover:text-blue-800 inline-block min-h-[44px] flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          View Details
        </Link>
      </td>
    </tr>
  );
}
