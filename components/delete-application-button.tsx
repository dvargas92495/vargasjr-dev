"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import ConfirmationModal, {
  ConfirmationModalHandle,
} from "./confirmation-modal";
import { useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const DeleteApplicationButton = ({ applicationId, applicationName }: { applicationId: string; applicationName: string }) => {
  const deleteModalRef = useRef<ConfirmationModalHandle>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const onClick = useCallback(() => {
    deleteModalRef.current?.openModal();
  }, [deleteModalRef]);

  const onConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete application');
      }

      router.push('/admin/applications');
    } catch (error) {
      console.error('Error deleting application:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete application');
    } finally {
      setIsDeleting(false);
    }
  }, [applicationId, router]);

  return (
    <>
      <button
        onClick={onClick}
        disabled={isDeleting}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete application"
      >
        <TrashIcon className="w-4 h-4 mr-2" />
        {isDeleting ? 'Deleting...' : 'Delete Application'}
      </button>
      <ConfirmationModal
        ref={deleteModalRef}
        header="Delete Application"
        body={
          <p className="text-sm text-gray-300">
            Are you sure you want to delete the application &ldquo;{applicationName}&rdquo;? This action
            cannot be undone and will also delete all associated workspaces.
          </p>
        }
        onConfirm={onConfirm}
      />
    </>
  );
};

export default DeleteApplicationButton;
