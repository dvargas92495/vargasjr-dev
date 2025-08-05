"use client";

import { useRouter } from "next/navigation";

const StartInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const startInstance = async () => {
    console.log(`[StartInstanceButton] Starting instance ${id}`);
    try {
      const response = await fetch("/api/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, operation: "START" }),
      });
      
      console.log(`[StartInstanceButton] Response status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[StartInstanceButton] Success response:`, result);
        router.refresh();
      } else {
        const errorText = await response.text();
        console.error(`[StartInstanceButton] Error response (${response.status}):`, errorText);
        alert(`Failed to start instance: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`[StartInstanceButton] Network/fetch error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Network error starting instance: ${errorMessage}`);
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
