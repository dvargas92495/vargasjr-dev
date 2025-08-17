import React from "react";
import JobRow from "@/components/job-row";
import RoutineJobRow from "@/components/routine-job-row";
import Link from "next/link";
import { JobsTable, RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { desc } from "drizzle-orm";

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

  const jobsWithLabels = jobs.map((job) => ({
    ...job,
    priority: convertPriorityToLabel(job.priority),
  }));

  const routineJobs = await db.select().from(RoutineJobsTable);

  const routineJobsWithStringDates = routineJobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
  }));

  const priorityOrder = { High: 1, Medium: 2, Low: 3 };

  const sortedJobs = [...jobsWithLabels].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <>
      <div className="flex-1">
        <h2 className="text-xl font-bold mb-4">Regular Jobs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-500 text-white">
                <th className="px-6 py-3 border-b text-left">Job Name</th>
                <th className="px-6 py-3 border-b text-left">Due Date</th>
                <th className="px-6 py-3 border-b text-left">Priority</th>
                <th className="px-6 py-3 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex-1 mt-8">
        <h2 className="text-xl font-bold mb-4">Routine Jobs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-500 text-white">
                <th className="px-6 py-3 border-b text-left">Name</th>
                <th className="px-6 py-3 border-b text-left">
                  Cron Expression
                </th>
                <th className="px-6 py-3 border-b text-left">Status</th>
                <th className="px-6 py-3 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routineJobsWithStringDates.map((job) => (
                <RoutineJobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
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
