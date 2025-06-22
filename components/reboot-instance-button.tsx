"use client";

import { useRouter } from "next/navigation";

const RebootInstanceButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const rebootInstance = async () => {
    const response = await fetch("/api/reboot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId: id }),
    });
    if (response.ok) {
      router.refresh();
    }
  };
  return (
    <button
      onClick={rebootInstance}
      className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600"
    >
      Reboot Agent
    </button>
  );
};

export default RebootInstanceButton;
