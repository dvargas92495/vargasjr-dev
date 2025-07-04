"use client";

import React, { useEffect, useState } from "react";
import JobRow from "@/components/job-row";

interface Job {
  id: string;
  name: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
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

    fetchJobs();
  }, []);

  const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
  
  const sortedJobs = [...jobs].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  if (loading) return <div className="p-6">Loading jobs...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <>
      <div className="flex-1">
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
    </>
  );
}
