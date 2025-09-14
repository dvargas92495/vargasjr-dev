"use client";

import React, { useRef, useCallback, useState } from "react";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import MergeContactModal, {
  MergeContactModalHandle,
} from "./merge-contact-modal";
import { mergeContact } from "@/app/actions";

const MergeContactButton = ({
  currentContactId,
  currentContactName,
}: {
  currentContactId: string;
  currentContactName: string;
}) => {
  const mergeModalRef = useRef<MergeContactModalHandle>(null);
  const [isMerging, setIsMerging] = useState(false);

  const onClick = useCallback(() => {
    mergeModalRef.current?.openModal();
  }, [mergeModalRef]);

  const onMerge = useCallback(
    async (targetContactId: string) => {
      setIsMerging(true);
      try {
        await mergeContact(currentContactId, targetContactId);
        window.location.reload();
      } catch (error) {
        console.error("Error merging contact:", error);
        alert(
          error instanceof Error ? error.message : "Failed to merge contact"
        );
      } finally {
        setIsMerging(false);
      }
    },
    [currentContactId]
  );

  return (
    <>
      <button
        onClick={onClick}
        disabled={isMerging}
        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
        title="Merge another contact into this one"
      >
        <ArrowsRightLeftIcon className="w-4 h-4 inline mr-2" />
        {isMerging ? "Merging..." : "Merge"}
      </button>
      <MergeContactModal
        ref={mergeModalRef}
        currentContactId={currentContactId}
        currentContactName={currentContactName}
        onMerge={onMerge}
      />
    </>
  );
};

export default MergeContactButton;
