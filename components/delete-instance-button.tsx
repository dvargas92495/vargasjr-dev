"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import ConfirmationModal, {
  ConfirmationModalHandle,
} from "./confirmation-modal";
import { useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const DeleteInstanceButton = ({
  id,
  instanceName,
}: {
  id: string;
  instanceName: string;
}) => {
  const deleteModalRef = useRef<ConfirmationModalHandle>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const onClick = useCallback(() => {
    deleteModalRef.current?.openModal();
  }, [deleteModalRef]);

  const onConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, operation: "DELETE" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete instance");
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting instance:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete instance"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [id, router]);

  return (
    <>
      <button
        onClick={onClick}
        disabled={isDeleting}
        className="bg-red-600 text-white p-2 rounded hover:bg-red-700 disabled:opacity-50"
        title="Delete instance"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
      <ConfirmationModal
        ref={deleteModalRef}
        header="Delete Instance"
        body={
          <p className="text-sm text-gray-300">
            Are you sure you want to delete the instance &ldquo;{instanceName}
            &rdquo; ({id})? This action cannot be undone and will permanently
            terminate the instance and delete its associated key pair.
          </p>
        }
        onConfirm={onConfirm}
      />
    </>
  );
};

export default DeleteInstanceButton;
