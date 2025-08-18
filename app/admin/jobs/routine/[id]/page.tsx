import React from "react";
import { getRoutineJob } from "@/app/actions";
import { getVellumSandboxUrlServer } from "@/app/lib/vellum-server-utils";
import RoutineJobDetailClient from "./client";

export default async function RoutineJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const routineJob = await getRoutineJob(id);
    const sandboxUrl = await getVellumSandboxUrlServer(routineJob.name);

    const routineJobWithSandbox = {
      ...routineJob,
      sandboxUrl,
    };

    return <RoutineJobDetailClient routineJob={routineJobWithSandbox} />;
  } catch (error) {
    return (
      <div className="p-6 text-red-600">
        Error: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
}
