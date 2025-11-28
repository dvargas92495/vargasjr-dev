import React from "react";
import { getJob } from "@/app/actions";

interface Job {
  id: string;
  name: string;
  description: string | null;
  dueDate: string;
  priority: string;
  createdAt: string;
  externalUrl: string | null;
}

interface JobDetailClientProps {
  job: Job;
}

function JobDetailClient({ job }: JobDetailClientProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-xl font-bold">Job Details</h2>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900">{job.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <p className="mt-1 text-sm text-gray-900">{job.priority}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Due Date
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(job.dueDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>
          {job.description && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <p className="mt-1 text-sm text-gray-900">{job.description}</p>
            </div>
          )}
          {job.externalUrl && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                External URL
              </label>
              <a
                href={job.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-blue-600 hover:underline"
              >
                {job.externalUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const job = await getJob(id);
    return <JobDetailClient job={job} />;
  } catch (error) {
    return (
      <div className="p-6 text-red-600">
        Error: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
}
