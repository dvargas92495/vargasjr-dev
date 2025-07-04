"use client";

import React from "react";
import JobRow from "@/components/job-row";

interface Job {
  id: string;
  name: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
}

const mockJobs: Job[] = [
  {
    id: '1',
    name: 'Update client dashboard UI',
    dueDate: new Date('2025-07-08'),
    priority: 'High'
  },
  {
    id: '2',
    name: 'Fix payment integration bug',
    dueDate: new Date('2025-07-06'),
    priority: 'High'
  },
  {
    id: '3',
    name: 'Implement user authentication',
    dueDate: new Date('2025-07-15'),
    priority: 'Medium'
  },
  {
    id: '4',
    name: 'Optimize database queries',
    dueDate: new Date('2025-07-20'),
    priority: 'Medium'
  },
  {
    id: '5',
    name: 'Update documentation',
    dueDate: new Date('2025-07-25'),
    priority: 'Low'
  },
  {
    id: '6',
    name: 'Refactor legacy code',
    dueDate: new Date('2025-07-30'),
    priority: 'Low'
  },
  {
    id: '7',
    name: 'Security audit review',
    dueDate: new Date('2025-07-05'),
    priority: 'High'
  },
  {
    id: '8',
    name: 'Performance monitoring setup',
    dueDate: new Date('2025-07-12'),
    priority: 'Medium'
  }
];

export default function JobsPage() {
  const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
  
  const sortedJobs = [...mockJobs].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

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
