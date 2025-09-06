"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import ConfirmationModal, {
  ConfirmationModalHandle,
} from "./confirmation-modal";
import { useRef, useCallback } from "react";
import { deleteMessage } from "@/app/actions";
import { useRouter } from "next/navigation";

const DeleteMessageButton = ({ 
  messageId, 
  inboxId 
}: { 
  messageId: string; 
  inboxId: string; 
}) => {
  const deleteModalRef = useRef<ConfirmationModalHandle>(null);
  const router = useRouter();

  const onClick = useCallback(() => {
    deleteModalRef.current?.openModal();
  }, [deleteModalRef]);

  const onConfirm = useCallback(async () => {
    try {
      await deleteMessage(messageId, inboxId);
      router.push(`/admin/inboxes/${inboxId}`);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  }, [messageId, inboxId, router]);

  return (
    <>
      <button
        onClick={onClick}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full transition-colors"
        title="Delete message thread"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
      <ConfirmationModal
        ref={deleteModalRef}
        header="Delete Message Thread"
        body={
          <p className="text-sm text-gray-300">
            Are you sure you want to delete this message thread? This action
            cannot be undone.
          </p>
        }
        onConfirm={onConfirm}
      />
    </>
  );
};

export default DeleteMessageButton;
