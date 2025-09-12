"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";

export interface EditCronModalHandle {
  openModal: () => void;
  closeModal: () => void;
}

interface EditCronModalProps {
  currentCronExpression: string;
  onSave: (cronExpression: string) => Promise<void>;
}

const EditCronModal = forwardRef<EditCronModalHandle, EditCronModalProps>(
  ({ currentCronExpression, onSave }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [scheduleDescription, setScheduleDescription] = useState("");
    const [cronExpression, setCronExpression] = useState(currentCronExpression);
    const [useNaturalLanguage, setUseNaturalLanguage] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openModal = useCallback(() => {
      setIsOpen(true);
      setCronExpression(currentCronExpression);
      setScheduleDescription("");
      setError(null);
    }, [currentCronExpression]);

    const closeModal = useCallback(() => {
      setIsOpen(false);
      setError(null);
      setLoading(false);
    }, []);

    useImperativeHandle(ref, () => ({
      openModal,
      closeModal,
    }));

    const handleSave = useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        let finalCronExpression = cronExpression;

        if (useNaturalLanguage && scheduleDescription.trim()) {
          const response = await fetch("/api/jobs/routine/convert-schedule", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              scheduleDescription: scheduleDescription.trim(),
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Failed to convert schedule description"
            );
          }

          const data = await response.json();
          finalCronExpression = data.cronExpression;
        }

        if (!finalCronExpression.trim()) {
          throw new Error(
            "Please provide either a schedule description or cron expression"
          );
        }

        await onSave(finalCronExpression);
        closeModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    }, [
      useNaturalLanguage,
      scheduleDescription,
      cronExpression,
      onSave,
      closeModal,
    ]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Edit Cron Schedule
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={useNaturalLanguage}
                        onChange={() => setUseNaturalLanguage(true)}
                        className="mr-2"
                      />
                      Natural Language
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!useNaturalLanguage}
                        onChange={() => setUseNaturalLanguage(false)}
                        className="mr-2"
                      />
                      Cron Expression
                    </label>
                  </div>

                  {useNaturalLanguage ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule Description
                      </label>
                      <input
                        type="text"
                        value={scheduleDescription}
                        onChange={(e) => setScheduleDescription(e.target.value)}
                        placeholder="e.g., every day at 8am, every Monday at 5pm"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Describe when you want this job to run in plain English
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cron Expression
                      </label>
                      <input
                        type="text"
                        value={cronExpression}
                        onChange={(e) => setCronExpression(e.target.value)}
                        placeholder="0 8 * * *"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: minute hour day month weekday
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={closeModal}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

EditCronModal.displayName = "EditCronModal";

export default EditCronModal;
