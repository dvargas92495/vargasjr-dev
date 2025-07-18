"use client";

import React from "react";

interface Job {
  id: string;
  name: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
}

const JobRow = ({ job }: { job: Job }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 font-semibold';
      case 'Medium':
        return 'text-yellow-600 font-semibold';
      case 'Low':
        return 'text-green-600 font-semibold';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 border-b">{job.name}</td>
      <td className="px-6 py-4 border-b">
        {job.dueDate.toLocaleDateString()}
      </td>
      <td className={`px-6 py-4 border-b ${getPriorityColor(job.priority)}`}>
        {job.priority}
      </td>
    </tr>
  );
};

export default JobRow;
