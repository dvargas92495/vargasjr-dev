"use client";

import React, { useState } from "react";
import { sendChatMessage } from "@/app/actions";

interface ChatInputProps {
  sessionId: string;
}

export default function ChatInput({ sessionId }: ChatInputProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setPending(true);
    setError(null);
    
    try {
      await sendChatMessage(sessionId, formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setPending(false);
    }
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <textarea
        name="message"
        placeholder="Type your message..."
        className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-none"
        required
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 self-end"
      >
        {pending ? "Sending..." : "Send Message"}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
