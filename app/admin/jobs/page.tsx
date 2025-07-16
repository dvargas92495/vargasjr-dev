"use client";

import React, { useEffect, useState } from "react";
import JobRow from "@/components/job-row";
import Link from "next/link";

interface Job {
  id: string;
  name: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
}

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [routineJobs, setRoutineJobs] = useState<RoutineJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch('/api/jobs');
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        const data = await response.json();
        const jobsWithDates = data.map((job: Omit<Job, 'dueDate'> & { dueDate: string }) => ({
          ...job,
          dueDate: new Date(job.dueDate),
        }));
        setJobs(jobsWithDates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const fetchRoutineJobs = async () => {
      try {
        const response = await fetch('/api/jobs/routine');
        if (response.ok) {
          const data = await response.json();
          setRoutineJobs(data);
        }
      } catch (err) {
        console.error('Failed to fetch routine jobs:', err);
      }
    };

    fetchJobs();
    fetchRoutineJobs();
  }, []);

  const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
  
  const sortedJobs = [...jobs].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  if (loading) return (
    <>
      <div className="p-6">Loading jobs...</div>
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
  if (error) return (
    <>
      <div className="p-6 text-red-600">Error: {error}</div>
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
            {routineJobs.map((job) => (
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
                  <Link
                    href={`/admin/jobs/routine/${job.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Details
                  </Link>
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
