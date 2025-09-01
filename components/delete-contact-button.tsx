"use client";

import React, { useRef, useCallback, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import ConfirmationModal, {
  ConfirmationModalHandle,
} from "./confirmation-modal";
import { useRouter } from "next/navigation";
import { deleteContact } from "@/app/actions";

const DeleteContactButton = ({
  id,
  contactName,
}: {
  id: string;
  contactName: string;
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
      await deleteContact(id);
      router.push("/admin/crm");
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete contact"
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
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        title="Delete contact"
      >
        <TrashIcon className="w-4 h-4 inline mr-2" />
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      <ConfirmationModal
        ref={deleteModalRef}
        header="Delete Contact"
        body={
          <p className="text-sm text-gray-300">
            Are you sure you want to delete the contact &ldquo;
            {contactName}
            &rdquo;? This action cannot be undone and will permanently remove
            the contact and all associated chat sessions.
          </p>
        }
        onConfirm={onConfirm}
      />
    </>
  );
};

export default DeleteContactButton;
