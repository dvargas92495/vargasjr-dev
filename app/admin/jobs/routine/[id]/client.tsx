"use client";

import React, { useState } from "react";
import TestButton from "./test-button";
import ExecutionHistory from "./execution-history";
import DeleteRoutineJobButton from "@/components/delete-routine-job-button";
import EditCronButton from "./edit-cron-button";

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  sandboxUrl?: string | null;
}

interface RoutineJobDetailClientProps {
  routineJob: RoutineJob;
}

export default function RoutineJobDetailClient({
  routineJob,
}: RoutineJobDetailClientProps) {
  const [currentRoutineJob, setCurrentRoutineJob] = useState(routineJob);

  const handleCronUpdate = (updatedJob: RoutineJob) => {
    setCurrentRoutineJob(updatedJob);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-xl font-bold">Routine Job Details</h2>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {currentRoutineJob.name}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cron Expression
            </label>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-900">
                {currentRoutineJob.cronExpression}
              </p>
              <EditCronButton
                routineJob={currentRoutineJob}
                onUpdate={handleCronUpdate}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {currentRoutineJob.enabled ? (
                <span className="text-green-600 font-semibold">✓ Enabled</span>
              ) : (
                <span className="text-red-600 font-semibold">✗ Disabled</span>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(currentRoutineJob.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <TestButton routineJobId={currentRoutineJob.id} />

        {currentRoutineJob.sandboxUrl && (
          <a
            href={currentRoutineJob.sandboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Open in Vellum Sandbox
          </a>
        )}

        <DeleteRoutineJobButton
          id={currentRoutineJob.id}
          routineJobName={currentRoutineJob.name}
        />
      </div>

      <ExecutionHistory routineJobId={currentRoutineJob.id} />
    </div>
  );
}
