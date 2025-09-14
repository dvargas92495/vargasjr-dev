import React from "react";
import { getRoutineJob } from "@/app/actions";
import { getVellumSandboxUrlServer } from "@/app/lib/vellum-server-utils";
import RoutineJobDetailClient from "./client";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

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
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/jobs">
            <button className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          </Link>
          <h2 className="text-xl font-bold">Routine Job Details</h2>
        </div>
        <div className="text-red-600">
          Error: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }
}
