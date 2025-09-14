"use client";

import React, { useRef, useCallback } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import ConfirmationModal, {
  ConfirmationModalHandle,
} from "./confirmation-modal";
import { deleteInbox } from "@/app/actions";
import { useRouter } from "next/navigation";

const DeleteInboxButton = ({ inboxId }: { inboxId: string }) => {
  const deleteModalRef = useRef<ConfirmationModalHandle>(null);
  const router = useRouter();

  const onClick = useCallback(() => {
    deleteModalRef.current?.openModal();
  }, [deleteModalRef]);

  const onConfirm = useCallback(async () => {
    try {
      await deleteInbox(inboxId);
      router.push("/admin/inboxes");
    } catch (error) {
      console.error("Failed to delete inbox:", error);
    }
  }, [inboxId, router]);

  return (
    <>
      <button
        onClick={onClick}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        title="Delete inbox"
      >
        <TrashIcon className="w-5 h-5 inline mr-2" />
        Delete
      </button>
      <ConfirmationModal
        ref={deleteModalRef}
        header="Delete Inbox"
        body={
          <p className="text-sm text-gray-300">
            Are you sure you want to delete this inbox and all its messages?
            This action cannot be undone.
          </p>
        }
        onConfirm={onConfirm}
      />
    </>
  );
};

export default DeleteInboxButton;
