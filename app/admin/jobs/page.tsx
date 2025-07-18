import React from "react";
import JobRow from "@/components/job-row";
import Link from "next/link";
import { JobsTable, RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { desc } from "drizzle-orm";
import { getVellumSandboxUrlServer } from "@/app/lib/vellum-server-utils";

export default async function JobsPage() {
  const db = getDb();
  
  const jobs = await db
    .select({
      id: JobsTable.id,
      name: JobsTable.name,
      dueDate: JobsTable.dueDate,
      priority: JobsTable.priority,
      createdAt: JobsTable.createdAt,
    })
    .from(JobsTable)
    .orderBy(desc(JobsTable.priority));

  const jobsWithLabels = jobs.map(job => ({
    ...job,
    priority: convertPriorityToLabel(job.priority),
  }));

  const routineJobs = await db.select().from(RoutineJobsTable);
  
  const routineJobsWithSandbox = await Promise.all(
    routineJobs.map(async (job) => {
      const sandboxUrl = await getVellumSandboxUrlServer(job.name);
      return {
        ...job,
        sandboxUrl,
      };
    })
  );

  const routineJobsWithStringDates = routineJobsWithSandbox.map(job => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
  }));

  const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
  
  const sortedJobs = [...jobsWithLabels].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <>
      <div className="flex-1">
        <h2 className="text-xl font-bold mb-4">Regular Jobs</h2>
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500">
              <th className="px-6 py-3 border-b text-left">Job Name</th>
              <th className="px-6 py-3 border-b text-left">Due Date</th>
              <th className="px-6 py-3 border-b text-left">Priority</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex-1 mt-8">
        <h2 className="text-xl font-bold mb-4">Routine Jobs</h2>
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">Cron Expression</th>
              <th className="px-6 py-3 border-b text-left">Status</th>
              <th className="px-6 py-3 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {routineJobsWithStringDates.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
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
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/jobs/routine/${job.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </Link>
                    {job.sandboxUrl && (
                      <a
                        href={job.sandboxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800"
                      >
                        Sandbox
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Link
          href="/admin/jobs/routine/new"
          className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          New Routine Job
        </Link>
      </div>
    </>
  );
}
