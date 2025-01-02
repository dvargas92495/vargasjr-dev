"use client";

import { useRouter } from "next/navigation";

const StartInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const startInstance = async () => {
    const response = await fetch("/api/instances", {
      method: "POST",
      body: JSON.stringify({ id, operation: "START" }),
    });
    if (response.ok) {
      router.refresh();
    }
  };
  return (
    <button
      onClick={startInstance}
      className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
    >
      Start Instance
    </button>
  );
};

export default StartInstanceButton;
