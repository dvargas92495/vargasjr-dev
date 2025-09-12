"use client";

import React, { useRef, useState } from "react";
import EditCronModal, { EditCronModalHandle } from "@/components/edit-cron-modal";

interface RoutineJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  sandboxUrl?: string | null;
}

interface EditCronButtonProps {
  routineJob: RoutineJob;
  onUpdate: (updatedJob: RoutineJob) => void;
}

export default function EditCronButton({ routineJob, onUpdate }: EditCronButtonProps) {
  const modalRef = useRef<EditCronModalHandle>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (cronExpression: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/routine/${routineJob.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cronExpression }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update cron expression");
      }

      const updatedJob = await response.json();
      onUpdate(updatedJob);
    } catch (error) {
      console.error("Failed to update cron expression:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => modalRef.current?.openModal()}
        disabled={loading}
        className="text-blue-600 hover:text-blue-800 text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Edit
      </button>
      <EditCronModal
        ref={modalRef}
        currentCronExpression={routineJob.cronExpression}
        onSave={handleSave}
      />
    </>
  );
}
