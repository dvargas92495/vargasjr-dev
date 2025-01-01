"use client";

import { useRouter } from "next/navigation";

const StopInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const stopInstance = async () => {
    const response = await fetch("/api/instances", {
      method: "POST",
      body: JSON.stringify({ id, operation: "STOP" }),
    });
    if (response.ok) {
      router.refresh();
    }
  };
  return (
    <button
      onClick={stopInstance}
      className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
    >
      Stop Instance
    </button>
  );
};

export default StopInstanceButton;
