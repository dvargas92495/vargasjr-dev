import React from "react";
import { getJob } from "@/app/actions";
import JobDetailClient from "./client";


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
        Error: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }
}
